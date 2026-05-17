import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const glob_find: Tool = {
  name: 'glob_find',
  description: '使用 glob 模式匹配查找文件',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob 匹配模式，如 **/*.ts' },
      cwd: { type: 'string', description: '搜索根目录' },
      ignore: { type: 'array', items: { type: 'string' }, description: '忽略模式列表' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['pattern'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const pattern = params.pattern as string;
      const cwd = (params.cwd as string) ? resolve(params.cwd as string) : process.cwd();
      const ignore = (params.ignore as string[]) ?? [];
      const maxResults = (params.max_results as number) ?? 1000;
      const fg = await import('fast-glob');
      const files = await fg.default(pattern, {
        cwd,
        ignore: ['node_modules/**', '.git/**', ...ignore],
        absolute: false,
        dot: false,
        onlyFiles: true,
      });
      const results = files.slice(0, maxResults);
      return {
        success: true,
        output: results.join('\n'),
        metadata: { count: results.length, total: files.length, pattern },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
