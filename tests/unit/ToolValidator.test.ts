import { describe, it, expect } from 'vitest';
import { ToolValidator } from '../../src/tools/ToolValidator.js';
import type { Tool } from '../../src/tools/tool-types.js';

describe('ToolValidator', () => {
  const validator = new ToolValidator();

  const readFileTool: Tool = {
    name: 'read_file',
    description: 'Read file',
    category: 'filesystem',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '文件路径' },
        offset: { type: 'integer', description: '起始行' },
        limit: { type: 'integer', description: '行数' },
      },
      required: ['file_path'],
    },
    dangerous: false,
    requiresApproval: false,
    async execute() {
      return { success: true, output: '' };
    },
  };

  it('应验证正确的参数', () => {
    const result = validator.validate(readFileTool, { file_path: '/test.ts' });
    expect(result.success).toBe(true);
  });

  it('应检测缺少必需参数', () => {
    const result = validator.validate(readFileTool, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('缺少必需参数');
    expect(result.error).toContain('file_path');
  });

  it('应检测错误的参数类型', () => {
    const result = validator.validate(readFileTool, { file_path: 123 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('应为字符串类型');
  });

  it('valid params with extra fields pass', () => {
    const result = validator.validate(readFileTool, {
      file_path: '/test.ts',
      offset: 10,
      limit: 20,
      extra_field: 'ignored',
    });
    expect(result.success).toBe(true);
  });

  it('应验证枚举值', () => {
    const enumTool: Tool = {
      name: 'set_theme',
      description: 'Set theme',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          theme: { type: 'string', description: '主题', enum: ['dark', 'light'] },
        },
        required: [],
      },
      dangerous: false,
      requiresApproval: false,
      async execute() {
        return { success: true, output: '' };
      },
    };
    const good = validator.validate(enumTool, { theme: 'dark' });
    expect(good.success).toBe(true);

    const bad = validator.validate(enumTool, { theme: 'blue' });
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('不在允许范围内');
  });

  it('应验证数组类型参数', () => {
    const arrayTool: Tool = {
      name: 'batch_read',
      description: 'Batch read',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            description: 'Paths',
            items: { type: 'string' },
          },
        },
        required: ['paths'],
      },
      dangerous: false,
      requiresApproval: false,
      async execute() {
        return { success: true, output: '' };
      },
    };
    const good = validator.validate(arrayTool, { paths: ['a.ts', 'b.ts'] });
    expect(good.success).toBe(true);

    const badType = validator.validate(arrayTool, { paths: 'not_array' });
    expect(badType.success).toBe(false);
    expect(badType.error).toContain('应为数组类型');

    const badItem = validator.validate(arrayTool, { paths: [1, 2, 3] });
    expect(badItem.success).toBe(false);
    expect(badItem.error).toContain('应为字符串类型');
  });

  it('应验证布尔类型参数', () => {
    const boolTool: Tool = {
      name: 'set_flag',
      description: 'Set flag',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enabled' },
        },
        required: [],
      },
      dangerous: false,
      requiresApproval: false,
      async execute() {
        return { success: true, output: '' };
      },
    };
    expect(validator.validate(boolTool, { enabled: true }).success).toBe(true);
    expect(validator.validate(boolTool, { enabled: 'yes' }).success).toBe(false);
  });
});
