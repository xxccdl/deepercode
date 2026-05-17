import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const find_definition: Tool = {
  name: 'find_definition',
  description: '查找指定符号的定义位置',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '符号名称' },
      cwd: { type: 'string', description: '搜索根目录' },
    },
    required: ['name'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const name = params.name as string;
      const cwd = (params.cwd as string) ? resolve(params.cwd as string) : process.cwd();

      const fg = await import('fast-glob');
      const files = await fg.default('**/*.{ts,js,tsx,jsx}', {
        cwd,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        onlyFiles: true,
      });

      const defRegex = new RegExp(
        `(?:function\\s+${escapeRegex(name)}\\b|` +
        `class\\s+${escapeRegex(name)}\\b|` +
        `(?:const|let|var)\\s+${escapeRegex(name)}\\s*=|` +
        `interface\\s+${escapeRegex(name)}\\b|` +
        `type\\s+${escapeRegex(name)}\\s*=|` +
        `(?:export\\s+)?(?:async\\s+)?${escapeRegex(name)}\\s*\\([^)]*\\)\\s*\\{|` +
        `this\\.${escapeRegex(name)}\\s*=\\s*(?:async\\s+)?(?:function|\\(|${escapeRegex(name)})|` +
        `(?:public|private|protected|static|readonly)?\\s*(?:async\\s+)?${escapeRegex(name)}\\s*\\([^)]*\\)\\s*\\{` +
        `)`,
        'gmi'
      );

      const results: { file: string; line: number; text: string }[] = [];
      const maxFileSize = 2 * 1024 * 1024;

      for (const fp of files) {
        try {
          const stat = statSync(fp);
          if (stat.size > maxFileSize) continue;
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (defRegex.test(lines[i])) {
              defRegex.lastIndex = 0;
              results.push({
                file: relative(cwd, fp),
                line: i + 1,
                text: lines[i].trim(),
              });
            }
          }
        } catch { /* skip */ }
      }

      const output = results.length > 0
        ? results.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n')
        : `未找到 "${name}" 的定义`;

      return {
        success: true,
        output,
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
