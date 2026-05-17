import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const fuzzy_find: Tool = {
  name: 'fuzzy_find',
  description: '模糊匹配文件名',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '模糊文件名' },
      cwd: { type: 'string', description: '搜索目录' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['name'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const name = (params.name as string).toLowerCase();
      const cwd = (params.cwd as string) ? resolve(params.cwd as string) : process.cwd();
      const maxResults = (params.max_results as number) ?? 20;

      const fg = await import('fast-glob');
      const files = await fg.default('**/*', {
        cwd,
        absolute: false,
        ignore: ['node_modules/**', '.git/**'],
        onlyFiles: true,
      });

      const scored = files
        .map(f => ({ file: f, score: fuzzyScore(name, f.toLowerCase()) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      const output = scored.length > 0
        ? scored.map(r => r.file).join('\n')
        : '未找到匹配文件';

      return { success: true, output, metadata: { count: scored.length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function fuzzyScore(needle: string, haystack: string): number {
  let p = 0;
  let prevMatch = -2;
  let score = 0;
  for (let i = 0; i < needle.length && p < haystack.length; i++) {
    const nc = needle[i];
    let found = false;
    while (p < haystack.length) {
      if (haystack[p] === nc) {
        score += 10;
        if (p === prevMatch + 1) score += 5;
        prevMatch = p;
        p++;
        found = true;
        break;
      }
      p++;
    }
    if (!found) return 0;
  }
  const fileName = haystack.split(/[/\\]/).pop() ?? '';
  if (fileName.includes(needle)) score += 30;
  if (fileName.startsWith(needle)) score += 20;
  return score;
}
