import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const codebase_search: Tool = {
  name: 'codebase_search',
  description: '代码库语义搜索，基于关键词进行加权评分搜索',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询关键词' },
      cwd: { type: 'string', description: '搜索根目录' },
      glob: { type: 'string', description: '文件过滤模式' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['query'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const query = (params.query as string).toLowerCase();
      const cwd = (params.cwd as string) ? resolve(params.cwd as string) : process.cwd();
      const glob = (params.glob as string) ?? '**/*.{ts,js,tsx,jsx,py,java,go,rs}';
      const maxResults = (params.max_results as number) ?? 50;
      const keywords = query.split(/\s+/).filter(k => k.length > 0);

      const fg = await import('fast-glob');
      const files = await fg.default(glob, {
        cwd,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '*.min.*'],
        onlyFiles: true,
      });

      const scored: { file: string; score: number; snippet: string }[] = [];
      const maxFileSize = 500 * 1024;

      for (const fp of files) {
        try {
          const stat = statSync(fp);
          if (stat.size > maxFileSize) continue;
          const content = readFileSync(fp, 'utf-8');
          const lower = content.toLowerCase();
          let score = 0;
          for (const kw of keywords) {
            const matches = lower.split(kw).length - 1;
            score += matches * 10;
          }
          const fileName = fp.split(/[/\\]/).pop()?.toLowerCase() ?? '';
          for (const kw of keywords) {
            if (fileName.includes(kw)) score += 50;
          }
          if (score > 0) {
            const idx = lower.indexOf(keywords[0]);
            const snippet = idx >= 0
              ? content.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ')
              : content.slice(0, 120).replace(/\n/g, ' ');
            scored.push({ file: relative(cwd, fp), score, snippet });
          }
        } catch { /* skip */ }
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, maxResults);
      const output = top.length > 0
        ? top.map(r => `${r.file} (score: ${r.score})\n  ${r.snippet}`).join('\n\n')
        : '未找到相关结果';

      return { success: true, output, metadata: { total: scored.length, shown: top.length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
