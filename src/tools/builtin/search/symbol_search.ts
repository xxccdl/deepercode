import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const symbol_search: Tool = {
  name: 'symbol_search',
  description: '在代码库中搜索符号（函数、类、变量定义）',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '符号名称' },
      cwd: { type: 'string', description: '搜索根目录' },
      type: { type: 'string', description: '符号类型: function, class, variable, interface, type', enum: ['function', 'class', 'variable', 'interface', 'type', 'all'] },
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
      const symbolType = (params.type as string) ?? 'all';
      const maxResults = (params.max_results as number) ?? 50;

      const patterns: [string, RegExp][] = [];
      if (symbolType === 'all' || symbolType === 'function') {
        patterns.push(['function', new RegExp(`(?:function\\s+${name}|${name}\\s*[=:]\\s*(?:async\\s+)?(?:function|\\([^)]*\\)\\s*=>)|(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`, 'gmi')]);
      }
      if (symbolType === 'all' || symbolType === 'class') {
        patterns.push(['class', new RegExp(`class\\s+${name}\\b`, 'gmi')]);
      }
      if (symbolType === 'all' || symbolType === 'variable') {
        patterns.push(['variable', new RegExp(`(?:const|let|var)\\s+${name}\\b`, 'gmi')]);
      }
      if (symbolType === 'all' || symbolType === 'interface') {
        patterns.push(['interface', new RegExp(`interface\\s+${name}\\b`, 'gmi')]);
      }
      if (symbolType === 'all' || symbolType === 'type') {
        patterns.push(['type', new RegExp(`type\\s+${name}\\b`, 'gmi')]);
      }

      const fg = await import('fast-glob');
      const files = await fg.default('**/*.{ts,js,tsx,jsx}', {
        cwd,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        onlyFiles: true,
      });

      const results: string[] = [];
      const maxFileSize = 2 * 1024 * 1024;

      for (const fp of files) {
        if (results.length >= maxResults) break;
        try {
          const stat = statSync(fp);
          if (stat.size > maxFileSize) continue;
          const content = readFileSync(fp, 'utf-8');
          for (const [type, regex] of patterns) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(content)) !== null && results.length < maxResults) {
              const line = content.slice(0, match.index).split('\n').length;
              results.push(`${relative(cwd, fp)}:${line}: [${type}] ${match[0].trim()}`);
            }
          }
        } catch { /* skip */ }
      }

      return {
        success: true,
        output: results.join('\n') || '未找到匹配符号',
        metadata: { count: results.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
