import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor } from '../../src/tools/ToolExecutor.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import type { Tool, ToolCall } from '../../src/tools/tool-types.js';

function safeTool(name: string): Tool {
  return {
    name,
    description: `Tool ${name}`,
    category: 'filesystem',
    parameters: { type: 'object', properties: {}, required: [] },
    dangerous: false,
    requiresApproval: false,
    async execute(params) {
      return { success: true, output: JSON.stringify(params) };
    },
  };
}

function dangerousTool(name: string): Tool {
  return {
    name,
    description: `Dangerous tool ${name}`,
    category: 'shell',
    parameters: { type: 'object', properties: {}, required: [] },
    dangerous: true,
    requiresApproval: true,
    async execute() {
      return { success: true, output: 'executed' };
    },
  };
}

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  it('应执行已注册的工具', async () => {
    registry.register(safeTool('read_file'));
    const call: ToolCall = {
      id: 'call1',
      name: 'read_file',
      arguments: { path: '/test.ts' },
    };
    const result = await executor.execute(call);
    expect(result.callId).toBe('call1');
    expect(result.result.success).toBe(true);
    expect(result.result.output).toContain('path');
  });

  it('未知工具应返回错误', async () => {
    const call: ToolCall = {
      id: 'call2',
      name: 'unknown_tool',
      arguments: {},
    };
    const result = await executor.execute(call);
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('未知工具');
  });

  it('应拒绝危险工具 (非交互模式)', async () => {
    registry.register(dangerousTool('nuke_system'));
    const call: ToolCall = {
      id: 'call3',
      name: 'nuke_system',
      arguments: {},
    };
    const result = await executor.execute(call);
    expect(result.result.success).toBe(false);
    expect(result.result.metadata).toBeDefined();
    expect((result.result.metadata as any)?.requiresUserApproval).toBe(true);
  });

  it('应执行批量调用', async () => {
    registry.register(safeTool('t1'));
    registry.register(safeTool('t2'));
    const calls: ToolCall[] = [
      { id: 'c1', name: 't1', arguments: { a: 1 } },
      { id: 'c2', name: 't2', arguments: { b: 2 } },
    ];
    const results = await executor.executeBatch(calls);
    expect(results).toHaveLength(2);
    expect(results[0].callId).toBe('c1');
    expect(results[1].callId).toBe('c2');
  });

  it('应并行执行调用', async () => {
    const startTimes: number[] = [];
    const tool: Tool = {
      name: 'slow_tool',
      description: 'Slow tool',
      category: 'filesystem',
      parameters: { type: 'object', properties: {}, required: [] },
      dangerous: false,
      requiresApproval: false,
      async execute(params) {
        startTimes.push(Date.now());
        await new Promise(r => setTimeout(r, 50));
        return { success: true, output: 'done' };
      },
    };
    registry.register(tool);
    const calls: ToolCall[] = [
      { id: 'c1', name: 'slow_tool', arguments: {} },
      { id: 'c2', name: 'slow_tool', arguments: {} },
      { id: 'c3', name: 'slow_tool', arguments: {} },
    ];
    const results = await executor.executeParallel(calls);
    expect(results).toHaveLength(3);
    expect(startTimes).toHaveLength(3);
    // 并行执行：所有开始时间应在 30ms 内
    const maxDiff = Math.max(...startTimes) - Math.min(...startTimes);
    expect(maxDiff).toBeLessThan(30);
  });

  it('工具超时应返回错误', async () => {
    const slowTool: Tool = {
      name: 'very_slow',
      description: 'Very slow tool',
      category: 'filesystem',
      parameters: { type: 'object', properties: {}, required: [] },
      dangerous: false,
      requiresApproval: false,
      async execute() {
        await new Promise(r => setTimeout(r, 5000));
        return { success: true, output: 'done' };
      },
    };
    registry.register(slowTool);
    const call: ToolCall = { id: 'c1', name: 'very_slow', arguments: {} };
    const result = await executor.execute(call, undefined, 100);
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('超时');
  }, 5000);

  it('应处理工具抛出异常', async () => {
    const errorTool: Tool = {
      name: 'bad_tool',
      description: 'Throws error',
      category: 'filesystem',
      parameters: { type: 'object', properties: {}, required: [] },
      dangerous: false,
      requiresApproval: false,
      async execute() {
        throw new Error('模拟错误');
      },
    };
    registry.register(errorTool);
    const call: ToolCall = { id: 'c1', name: 'bad_tool', arguments: {} };
    const result = await executor.execute(call);
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('模拟错误');
  });
});
