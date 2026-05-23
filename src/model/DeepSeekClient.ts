import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatMessage, DeepSeekConfig, StreamChunk } from './types.js';
import type { ToolDefinition } from '../tools/tool-types.js';
import { RetryManager } from './RetryManager.js';
import { StreamHandler } from './StreamHandler.js';
import { DEEPER_HOME } from '../core/constants.js';
import { logger } from '../core/logger.js';

interface ChatCompletionRequest {
  model: string;
  messages: Array<Record<string, unknown>>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string;
}

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 3;

function reorderMsgFields(msg: Record<string, unknown>, name: string): Record<string, unknown> {
  const ordered: Record<string, unknown> = { role: msg.role };
  if (msg.content !== undefined) ordered.content = msg.content;
  ordered.name = name;
  if (msg.reasoning_content !== undefined) ordered.reasoning_content = msg.reasoning_content;
  if (msg.tool_calls !== undefined) ordered.tool_calls = msg.tool_calls;
  if (msg.tool_call_id !== undefined) ordered.tool_call_id = msg.tool_call_id;
  return ordered;
}

const isRetryable = (error: Error): boolean => {
  const msg = error.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
  if (msg.includes('timeout') || msg.includes('abort')) return true;
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  return false;
};

export class DeepSeekClient {
  private config: DeepSeekConfig;
  private retryManager: RetryManager;

  constructor(config: DeepSeekConfig) {
    this.config = config;
    this.retryManager = new RetryManager(MAX_RETRIES);
  }

  async chatStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    overrides?: Partial<DeepSeekConfig>,
  ): Promise<AsyncIterable<StreamChunk>> {
    const cfg = this.mergeConfig(overrides);
    const body = this.buildRequestBody(messages, tools, cfg, true);

    const response = await this.retryManager.execute(async () => {
      return this.retryManager.withTimeout(
        (signal) => this.makeRequest(cfg, body, signal),
        DEFAULT_TIMEOUT_MS,
        cfg.signal,
      );
    }, isRetryable);

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    return this.createStreamIterable(response.body);
  }

  private async *createStreamIterable(body: unknown): AsyncIterable<StreamChunk> {
    const handler = new StreamHandler();
    const decoder = new TextDecoder();
    let buffer = '';
    const stream = body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') {
            yield { type: 'done' };
            return;
          }
          const result = handler.handleEvent(data);
          if (result) {
            if (Array.isArray(result)) { for (const r of result) yield r; }
            else yield result;
          }
        }
      }
    }

    buffer += decoder.decode();
    const remaining = buffer.trim();
    if (remaining.startsWith('data: ')) {
      const data = remaining.slice(6).trim();
      if (data !== '[DONE]') {
        const result = handler.handleEvent(data);
        if (result) {
          if (Array.isArray(result)) { for (const r of result) yield r; }
          else yield result;
        }
      }
    }

    if (!handler.isFinished()) {
      yield { type: 'done' };
    }
  }

  private buildRequestBody(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    config: DeepSeekConfig,
    stream: boolean,
  ): string {
    const body: ChatCompletionRequest = {
      model: config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.reasoning_content || m.thinking) {
          msg.reasoning_content = m.reasoning_content || m.thinking;
        }
        if (m.role === 'tool') {
          msg.name = m.name || 'tool';
        } else if (m.role === 'assistant' && m.tool_calls?.length) {
          msg.name = m.name || 'assistant';
        } else if (m.name) {
          msg.name = m.name;
        }
        if (m.tool_calls) {
          msg.tool_calls = m.tool_calls.map((tc: any) => {
            const fn = tc.function || tc;
            let args: string;
            if (typeof fn.arguments === 'string') {
              args = fn.arguments;
            } else if (fn.arguments && typeof fn.arguments === 'object') {
              args = JSON.stringify(fn.arguments);
            } else {
              args = '{}';
            }
            return {
              id: tc.id,
              type: tc.type || 'function',
              function: {
                name: fn.name || 'unknown',
                arguments: args,
              },
            };
          });
        }
        if (m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id;
        }
        return msg;
      }),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream,
    };

    if (config.think?.enabled) {
      (body as unknown as Record<string, unknown>).thinking = {
        type: 'enabled',
        budget_tokens: Math.min(config.think.budgetTokens, config.maxTokens),
      };
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    let raw = JSON.stringify(body);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return raw;
    }

    const msgs = parsed.messages as Array<Record<string, unknown>> | undefined;
    if (msgs) {
      let fixedCount = 0;
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.role === 'tool' && !m.name) {
          msgs[i] = reorderMsgFields(m, m.tool_call_id as string || 'tool');
          logger.warn(`[SAFETY] parse-fix messages[${i}] tool missing name → "${msgs[i].name}"`);
          fixedCount++;
        }
        if (m.role === 'assistant' && m.tool_calls && !m.name) {
          msgs[i] = reorderMsgFields(m, 'assistant');
          logger.warn(`[SAFETY] parse-fix messages[${i}] assistant+tool_calls missing name → "assistant"`);
          fixedCount++;
        }
      }
      if (fixedCount > 0) {
        raw = JSON.stringify(parsed);
      }
    }

    const lastReqFile = join(DEEPER_HOME!, 'last_request.json');
    try { writeFileSync(lastReqFile, raw, 'utf-8'); } catch {}

    return raw;
  }

  private async makeRequest(config: DeepSeekConfig, body: string, signal?: AbortSignal): Promise<Response> {
    const url = `${config.baseUrl}/v1/chat/completions`;

    logger.debug('DeepSeek API request', { url, model: config.model });

    const fetchOpts: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json',
      },
      body,
    };

    const effectiveSignal = signal || config.signal;
    if (effectiveSignal) {
      fetchOpts.signal = effectiveSignal;
    }

    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      logger.error('DeepSeek API error', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.slice(0, 500),
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody.slice(0, 200)}`);
    }

    return response;
  }

  private mergeConfig(overrides?: Partial<DeepSeekConfig>): DeepSeekConfig {
    if (!overrides) {
      return this.config;
    }
    return {
      ...this.config,
      ...overrides,
      think: {
        ...this.config.think,
        ...(overrides.think ?? {}),
      },
    };
  }
}
