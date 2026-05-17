import type { ToolCall } from '../tools/tool-types.js';
import type { StreamChunk } from './types.js';

interface ParsedSSEEvent {
  data: string;
  event?: string;
  id?: string;
}

interface PendingToolCall {
  id: string;
  name: string;
  argsStr: string;
  index: number;
  started: boolean;
}

export class StreamHandler {
  private textBuffer: string;
  private thinkingBuffer: string;
  private toolCallBuffer: Map<number, PendingToolCall>;
  private finished: boolean;
  private lastYieldedIndex: number;

  constructor() {
    this.textBuffer = '';
    this.thinkingBuffer = '';
    this.toolCallBuffer = new Map();
    this.finished = false;
    this.lastYieldedIndex = -1;
  }

  reset(): void {
    this.textBuffer = '';
    this.thinkingBuffer = '';
    this.toolCallBuffer.clear();
    this.finished = false;
    this.lastYieldedIndex = -1;
  }

  handleEvent(event: string, data: string): StreamChunk | StreamChunk[] | null {
    if (event === 'error') {
      return { type: 'error', error: data || 'SSE error event' };
    }

    if (event === '[DONE]' || data === '[DONE]') {
      const results = this.finalizePendingToolCalls();
      this.finished = true;
      if (results.length > 0) {
        return [...results, { type: 'done' } as StreamChunk];
      }
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
        const finishReason = choice.finish_reason as string | undefined;
        if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'tool_calls') {
          const results = this.finalizePendingToolCalls();
          this.finished = true;
          if (results.length > 0) {
            return [...results, { type: 'done' } as StreamChunk];
          }
          return { type: 'done' };
        }
        return null;
      }

      if (delta.reasoning_content) {
        const thinkingChunk = delta.reasoning_content as string;
        this.thinkingBuffer += thinkingChunk;
        if (this.thinkingBuffer.length > 100_000) {
          this.thinkingBuffer = this.thinkingBuffer.slice(-80_000);
        }
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
        if (this.textBuffer.length > 500_000) {
          this.textBuffer = this.textBuffer.slice(-400_000);
        }
        return {
          type: 'text',
          content: textChunk,
        };
      }

      const finishReason = choice.finish_reason as string | undefined;
      if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'tool_calls') {
        const results = this.finalizePendingToolCalls();
        this.finished = true;
        if (results.length > 0) {
          return [...results, { type: 'done' } as StreamChunk];
        }
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
    const indices = [...this.toolCallBuffer.keys()].sort((a, b) => a - b);
    for (const idx of indices) {
      const pending = this.toolCallBuffer.get(idx);
      if (pending) {
        result.push({
          id: pending.id,
          name: pending.name,
          arguments: this.parseArgsStr(pending.argsStr),
          index: pending.index,
        });
      }
    }
    return result;
  }

  isFinished(): boolean {
    return this.finished;
  }

  private handleToolCallsDelta(toolCalls: Array<Record<string, unknown>>): StreamChunk[] {
    const results: StreamChunk[] = [];

    for (const tc of toolCalls) {
      const index = tc.index as number;
      const id = tc.id as string | undefined;
      const fn = tc.function as Record<string, unknown> | undefined;

      if (!this.toolCallBuffer.has(index)) {
        this.toolCallBuffer.set(index, {
          id: id ?? '',
          name: fn?.name as string ?? '',
          argsStr: '',
          index,
          started: false,
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
        existing.argsStr += fn.arguments as string;
      }

      if (!existing.started) {
        existing.started = true;
        if (this.lastYieldedIndex >= 0) {
          const prev = this.toolCallBuffer.get(this.lastYieldedIndex);
          if (prev && prev !== existing) {
            results.push({
              type: 'tool_call_end',
              tool_call: {
                id: prev.id,
                name: prev.name,
                arguments: this.parseArgsStr(prev.argsStr),
                index: prev.index,
              },
            } as StreamChunk);
          }
        }
        this.lastYieldedIndex = index;
        results.push({
          type: 'tool_call_start',
          tool_call: { id: existing.id, name: existing.name, index: existing.index },
        } as StreamChunk);
      }
    }

    return results;
  }

  private finalizePendingToolCalls(): StreamChunk[] {
    const results: StreamChunk[] = [];
    if (this.lastYieldedIndex >= 0) {
      const last = this.toolCallBuffer.get(this.lastYieldedIndex);
      if (last) {
        results.push({
          type: 'tool_call_end',
          tool_call: {
            id: last.id,
            name: last.name,
            arguments: this.parseArgsStr(last.argsStr),
            index: last.index,
          },
        } as StreamChunk);
      }
      this.lastYieldedIndex = -1;
    }
    return results;
  }

  private parseArgsStr(argsStr: string): Record<string, unknown> {
    if (!argsStr) return {};
    try {
      return JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      const trimmed = argsStr.trim();
      if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
        try {
          return JSON.parse(trimmed + '}') as Record<string, unknown>;
        } catch {
          try {
            return JSON.parse(trimmed + '}}') as Record<string, unknown>;
          } catch {}
        }
      }
      return {};
    }
  }
}
