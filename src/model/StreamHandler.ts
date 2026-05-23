import type { ToolCall } from '../tools/tool-types.js';
import type { StreamChunk } from './types.js';

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

  handleEvent(data: string): StreamChunk | StreamChunk[] | null {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const choices = parsed.choices as Array<Record<string, unknown>> | undefined;

      if (!choices || choices.length === 0) {
        return null;
      }

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;
      const finishReason = choice.finish_reason as string | undefined;

      if (!delta) {
        if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'tool_calls') {
          return this.doFinish();
        }
        return null;
      }

      const results: StreamChunk[] = [];

      if (delta.reasoning_content) {
        const chunk = delta.reasoning_content as string;
        this.thinkingBuffer += chunk;
        if (this.thinkingBuffer.length > 100_000) {
          this.thinkingBuffer = this.thinkingBuffer.slice(-80_000);
        }
        results.push({ type: 'thinking', content: chunk });
      }

      if (delta.tool_calls) {
        const tcResults = this.handleToolCallsDelta(delta.tool_calls as Array<Record<string, unknown>>);
        results.push(...tcResults);
      }

      if (delta.content) {
        const chunk = delta.content as string;
        this.textBuffer += chunk;
        if (this.textBuffer.length > 500_000) {
          this.textBuffer = this.textBuffer.slice(-400_000);
        }
        results.push({ type: 'text', content: chunk });
      }

      if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'tool_calls') {
        const finishResults = this.doFinish();
        if (Array.isArray(finishResults)) {
          results.push(...finishResults);
        } else {
          results.push(finishResults);
        }
      }

      return results.length > 0 ? results : null;
    } catch {
      return {
        type: 'error',
        error: `Failed to parse SSE data: ${data.slice(0, 200)}`,
      };
    }
  }

  private doFinish(): StreamChunk | StreamChunk[] {
    const results = this.finalizePendingToolCalls();
    this.finished = true;
    if (results.length > 0) {
      return [...results, { type: 'done' } as StreamChunk];
    }
    return { type: 'done' };
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

      if (id) existing.id = id;
      if (fn?.name) existing.name = fn.name as string;
      if (fn?.arguments) existing.argsStr += fn.arguments as string;

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
        let closing = '';
        let depth = 0;
        for (const ch of trimmed) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        while (depth > 0) { closing += '}'; depth--; }
        if (closing) {
          try { return JSON.parse(trimmed + closing) as Record<string, unknown>; } catch {}
        }
      }
      return {};
    }
  }
}
