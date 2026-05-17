import type { ToolCall } from '../tools/tool-types.js';
import type { StreamChunk } from './types.js';

interface ParsedSSEEvent {
  data: string;
  event?: string;
  id?: string;
}

export class StreamHandler {
  private textBuffer: string;
  private thinkingBuffer: string;
  private toolCallBuffer: Map<number, ToolCall>;
  private finished: boolean;

  constructor() {
    this.textBuffer = '';
    this.thinkingBuffer = '';
    this.toolCallBuffer = new Map();
    this.finished = false;
  }

  reset(): void {
    this.textBuffer = '';
    this.thinkingBuffer = '';
    this.toolCallBuffer.clear();
    this.finished = false;
  }

  handleEvent(event: string, data: string): StreamChunk | null {
    if (event === '[DONE]' || data === '[DONE]') {
      this.finished = true;
      return { type: 'done' };
    }

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const choices = parsed.choices as Array<Record<string, unknown>> | undefined;

      if (!choices || choices.length === 0) {
        return null;
      }

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;

      if (!delta) {
        return null;
      }

      if (delta.reasoning_content) {
        const thinkingChunk = delta.reasoning_content as string;
        this.thinkingBuffer += thinkingChunk;
        return {
          type: 'thinking',
          content: thinkingChunk,
        };
      }

      if (delta.tool_calls) {
        return this.handleToolCallsDelta(delta.tool_calls as Array<Record<string, unknown>>);
      }

      if (delta.content) {
        const textChunk = delta.content as string;
        this.textBuffer += textChunk;
        return {
          type: 'text',
          content: textChunk,
        };
      }

      const finishReason = choice.finish_reason as string | undefined;
      if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'tool_calls') {
        this.finished = true;
        return { type: 'done' };
      }
    } catch {
      return {
        type: 'error',
        error: `Failed to parse SSE data: ${data.slice(0, 200)}`,
      };
    }

    return null;
  }

  getAccumulatedText(): string {
    return this.textBuffer;
  }

  getAccumulatedThinking(): string {
    return this.thinkingBuffer;
  }

  getToolCalls(): ToolCall[] {
    const result: ToolCall[] = [];
    for (let i = 0; i < this.toolCallBuffer.size; i++) {
      const tc = this.toolCallBuffer.get(i);
      if (tc) {
        result.push(tc);
      }
    }
    return result;
  }

  isFinished(): boolean {
    return this.finished;
  }

  private handleToolCallsDelta(toolCalls: Array<Record<string, unknown>>): StreamChunk | null {
    for (const tc of toolCalls) {
      const index = tc.index as number;
      const id = tc.id as string | undefined;
      const fn = tc.function as Record<string, unknown> | undefined;

      if (!this.toolCallBuffer.has(index)) {
        this.toolCallBuffer.set(index, {
          id: id ?? '',
          name: fn?.name as string ?? '',
          arguments: {},
        });
      }

      const existing = this.toolCallBuffer.get(index)!;

      if (id) {
        existing.id = id;
      }
      if (fn?.name) {
        existing.name = fn.name as string;
      }
      if (fn?.arguments) {
        try {
          const argsStr = fn.arguments as string;
          const parsed = JSON.parse(argsStr) as Record<string, unknown>;
          existing.arguments = { ...existing.arguments, ...parsed };
        } catch {
          existing.arguments = existing.arguments || {};
        }
      }
    }

    const currentCall = this.toolCallBuffer.get(toolCalls[0].index as number);
    if (currentCall) {
      return {
        type: 'tool_call',
        tool_call: { ...currentCall, arguments: { ...currentCall.arguments } },
      };
    }

    return null;
  }
}
