import type { Tool, ToolCall, ToolCallResult, ToolResult } from './tool-types.js';
import { TOOL_SAFETY_MAP } from './tool-types.js';
import { ToolRegistry } from './ToolRegistry.js';

export interface ToolExecutionOptions {
  timeoutMs?: number;
}

export class ToolExecutor {
  private registry: ToolRegistry;
  private defaultTimeoutMs: number;

  constructor(registry: ToolRegistry, options: ToolExecutionOptions = {}) {
    this.registry = registry;
    this.defaultTimeoutMs = options.timeoutMs ?? 60000;
  }

  async execute(call: ToolCall, signal?: AbortSignal, timeoutMs?: number): Promise<ToolCallResult> {
    const startTime = Date.now();
    const tool = this.registry.get(call.name);

    if (!tool) {
      return {
        callId: call.id,
        result: { success: false, error: `未知工具: ${call.name}`, output: '' },
        timestamp: startTime,
      };
    }

    const safetyLevel = TOOL_SAFETY_MAP[call.name] ?? 'safe';
    if (tool.requiresApproval || safetyLevel === 'dangerous') {
      return {
        callId: call.id,
        result: {
          success: false,
          error: `工具 "${call.name}" 需要在交互模式下确认才能执行`,
          output: '',
          metadata: { requiresUserApproval: true },
        },
        timestamp: startTime,
      };
    }

    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;

    try {
      const resultPromise = tool.execute(call.arguments, signal);

      let result: ToolResult;
      if (effectiveTimeout > 0) {
        const timeoutPromise = new Promise<ToolResult>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`工具 "${call.name}" 执行超时 (${effectiveTimeout}ms)`));
          }, effectiveTimeout);
        });

        result = await Promise.race([resultPromise, timeoutPromise]);
      } else {
        result = await resultPromise;
      }

      return {
        callId: call.id,
        result,
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        callId: call.id,
        result: {
          success: false,
          error: message,
          output: '',
          metadata: { stack: err instanceof Error ? err.stack : undefined },
        },
        timestamp: Date.now(),
      };
    }
  }

  async executeBatch(calls: ToolCall[], signal?: AbortSignal): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    for (const call of calls) {
      if (signal?.aborted) break;
      results.push(await this.execute(call, signal));
    }
    return results;
  }

  async executeParallel(calls: ToolCall[], signal?: AbortSignal): Promise<ToolCallResult[]> {
    return Promise.all(calls.map(call => {
      if (signal?.aborted) {
        return {
          callId: call.id,
          result: { success: false, error: '已取消', output: '' },
          timestamp: Date.now(),
        } as ToolCallResult;
      }
      return this.execute(call, signal);
    }));
  }
}
