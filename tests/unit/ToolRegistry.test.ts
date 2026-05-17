import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import type { Tool } from '../../src/tools/tool-types.js';

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    category: 'filesystem',
    parameters: { type: 'object', properties: {}, required: [] },
    dangerous: false,
    requiresApproval: false,
    async execute(params) {
      return { success: true, output: JSON.stringify(params) };
    },
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('应该能注册工具', () => {
    const tool = makeTool({ name: 'read_file' });
    registry.register(tool);
    expect(registry.has('read_file')).toBe(true);
    expect(registry.count()).toBe(1);
  });

  it('注册重复工具应该抛出错误', () => {
    const tool = makeTool({ name: 'read_file' });
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow('工具已注册');
  });

  it('应该能获取工具', () => {
    const tool = makeTool({ name: 'write_file', category: 'filesystem' });
    registry.register(tool);
    const found = registry.get('write_file');
    expect(found).toBeDefined();
    expect(found!.name).toBe('write_file');
    expect(found!.category).toBe('filesystem');
  });

  it('获取不存在的工具返回 undefined', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('应该能注销工具', () => {
    registry.register(makeTool({ name: 'delete_file' }));
    registry.unregister('delete_file');
    expect(registry.has('delete_file')).toBe(false);
  });

  it('应该能按分类获取工具', () => {
    registry.register(makeTool({ name: 't1', category: 'filesystem' }));
    registry.register(makeTool({ name: 't2', category: 'filesystem' }));
    registry.register(makeTool({ name: 't3', category: 'search' }));

    const fsTools = registry.getByCategory('filesystem');
    expect(fsTools).toHaveLength(2);

    const searchTools = registry.getByCategory('search');
    expect(searchTools).toHaveLength(1);
  });

  it('getDefinitions 应返回正确的定义格式', () => {
    registry.register(makeTool({ name: 'read_file', category: 'filesystem' }));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toHaveProperty('name', 'read_file');
    expect(defs[0]).toHaveProperty('parameters');
    expect(defs[0]).not.toHaveProperty('execute');
  });

  it('categories 应返回所有分类', () => {
    registry.register(makeTool({ name: 'a', category: 'filesystem' }));
    registry.register(makeTool({ name: 'b', category: 'search' }));
    registry.register(makeTool({ name: 'c', category: 'shell' }));
    expect(registry.categories()).toHaveLength(3);
  });

  it('clear 应清空所有工具', () => {
    registry.register(makeTool({ name: 't1' }));
    registry.register(makeTool({ name: 't2' }));
    registry.clear();
    expect(registry.count()).toBe(0);
  });

  it('registerAll 应批量注册', () => {
    const tools: Tool[] = [
      makeTool({ name: 't1' }),
      makeTool({ name: 't2' }),
      makeTool({ name: 't3' }),
    ];
    registry.registerAll(tools);
    expect(registry.count()).toBe(3);
  });
});
