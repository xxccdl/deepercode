import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const find_references: Tool = {
  name: 'find_references',
  description: '查找指定符号的所有引用位置',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '符号名称' },
      cwd: { type: 'string', description: '搜索根目录' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['name'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const name = params.name as string;
      const cwd = (params.cwd as string) ? resolve(params.cwd as string) : process.cwd();
      const maxResults = (params.max_results as number) ?? 100;

      const fg = await import('fast-glob');
      const files = await fg.default('**/*.{ts,js,tsx,jsx}', {
        cwd,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        onlyFiles: true,
      });

      const refRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gm');
      const defRegex = new RegExp(`(?:function\\s+${escapeRegex(name)}|class\\s+${escapeRegex(name)}|(?:const|let|var)\\s+${escapeRegex(name)}\\s*=|interface\\s+${escapeRegex(name)}|type\\s+${escapeRegex(name)}\\s*=)`, 'gm');

      const results: { file: string; line: number; text: string; type: 'definition' | 'reference' }[] = [];
      const maxFileSize = 2 * 1024 * 1024;

      for (const fp of files) {
        if (results.length >= maxResults) break;
        try {
          const stat = statSync(fp);
          if (stat.size > maxFileSize) continue;
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (lines[i].match(refRegex)) {
              const isDef = defRegex.test(lines[i]);
              results.push({
                file: relative(cwd, fp),
                line: i + 1,
                text: lines[i].trim(),
                type: isDef ? 'definition' : 'reference',
              });
            }
          }
        } catch { /* skip */ }
      }

      const output = results.map(r => `${r.file}:${r.line} [${r.type}] ${r.text}`).join('\n');
      return {
        success: true,
        output: output || '未找到引用',
        metadata: { count: results.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
