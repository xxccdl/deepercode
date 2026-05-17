import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const search_package: Tool = {
  name: 'search_package',
  description: '搜索 npm 包',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '包名关键词' },
      count: { type: 'number', description: '返回数量' },
    },
    required: ['name'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const name = params.name as string;
      const count = (params.count as number) ?? 10;
      const output = execSync(
        `npm search "${name}" --registry https://registry.npmmirror.com --json 2>&1`,
        { encoding: 'utf-8', timeout: 15000 }
      );
      const results = JSON.parse(output);
      const items = (Array.isArray(results) ? results.slice(0, count) : [results]).map(
        (pkg: Record<string, unknown>) => ({
          name: pkg.name as string,
          version: pkg.version as string,
          description: pkg.description as string,
          author: (pkg.author as Record<string, unknown> | undefined)?.name || pkg.author,
        })
      );
      return {
        success: true,
        output: items.map((i: Record<string, unknown>) =>
          `${i.name}@${i.version}\n  ${i.description}\n  Author: ${i.author}`
        ).join('\n\n'),
        metadata: { count: items.length },
      };
    } catch {
      return {
        success: true,
        output: `请在 npm 官网搜索: https://www.npmjs.com/search?q=${encodeURIComponent(params.name as string)}`,
        metadata: { fallback: true },
      };
    }
  },
};
