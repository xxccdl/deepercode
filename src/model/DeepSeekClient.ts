import type { ChatMessage, DeepSeekConfig, StreamChunk } from './types.js';
import type { ToolDefinition, ToolCall } from '../tools/tool-types.js';
import { RetryManager } from './RetryManager.js';
import { StreamHandler } from './StreamHandler.js';
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

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
}

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 3;

export class DeepSeekClient {
  private config: DeepSeekConfig;
  private retryManager: RetryManager;

  constructor(config: DeepSeekConfig) {
    this.config = config;
    this.retryManager = new RetryManager(config.maxTokens > 0 ? MAX_RETRIES : MAX_RETRIES);
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    overrides?: Partial<DeepSeekConfig>,
  ): Promise<ChatMessage> {
    const cfg = this.mergeConfig(overrides);
    const body = this.buildRequestBody(messages, tools, cfg, false);

    const response = await this.retryManager.execute(async () => {
      const result = await this.retryManager.withTimeout(
        () => this.makeRequest(cfg, body),
        cfg.maxTokens > 0 ? DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      );
      return result;
    }, this.shouldRetry);

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No choices returned from API');
    }

    const choice = data.choices[0];
    const message = choice.message;

    const result: ChatMessage = {
      role: 'assistant',
      content: message.content,
    };

    if (message.tool_calls) {
      result.tool_calls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseArguments(tc.function.arguments),
      }));
    }

    if (message.reasoning_content) {
      result.thinking = message.reasoning_content;
    }

    return result;
  }

  async chatStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    overrides?: Partial<DeepSeekConfig>,
  ): Promise<AsyncIterable<StreamChunk>> {
    const cfg = this.mergeConfig(overrides);
    const body = this.buildRequestBody(messages, tools, cfg, true);

    const response = await this.retryManager.execute(async () => {
      const result = await this.retryManager.withTimeout(
        () => this.makeRequest(cfg, body),
        DEFAULT_TIMEOUT_MS,
      );
      return result;
    }, this.shouldRetry);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    return this.createStreamIterable(response.body);
  }

  private async *createStreamIterable(body: unknown): AsyncIterable<StreamChunk> {
    const handler = new StreamHandler();
    let buffer = '';
    const stream = body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      buffer += text;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          const result = handler.handleEvent('message', data);
          if (result) {
            yield result;
          }
        } else if (trimmed === 'data: [DONE]') {
          yield { type: 'done' };
          return;
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        const result = handler.handleEvent('message', data);
        if (result) {
          yield result;
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
        if (m.tool_calls) {
          msg.tool_calls = m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        if (m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id;
        }
        if (m.name) {
          msg.name = m.name;
        }
        return msg;
      }),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream,
    };

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

    return JSON.stringify(body);
  }

  private async makeRequest(config: DeepSeekConfig, body: string): Promise<Response> {
    const url = `${config.baseUrl}/v1/chat/completions`;

    logger.debug('DeepSeek API request', { url, model: config.model });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json',
      },
      body,
    });

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

  private shouldRetry(error: Error, attempt: number): boolean {
    const message = error.message.toLowerCase();

    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
    if (message.includes('5') && (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504'))) {
      return true;
    }
    if (message.includes('timeout') || message.includes('abort')) {
      return attempt < 2;
    }
    if (message.includes('econnreset') || message.includes('econnrefused')) {
      return true;
    }

    return false;
  }

  private parseArguments(argsStr: string): Record<string, unknown> {
    try {
      return JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      return {};
    }
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
