import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const grep_search: Tool = {
  name: 'grep_search',
  description: '使用正则表达式搜索文件内容',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '搜索正则表达式' },
      file_path: { type: 'string', description: '目标文件路径' },
      dir_path: { type: 'string', description: '目标目录路径' },
      case_sensitive: { type: 'boolean', description: '是否区分大小写' },
      glob: { type: 'string', description: '文件过滤模式，如 *.ts' },
      max_results: { type: 'number', description: '最大结果数' },
      context_lines: { type: 'number', description: '上下文行数' },
    },
    required: ['pattern'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const pattern = params.pattern as string;
      const filePath = params.file_path as string | undefined;
      const dirPath = params.dir_path as string | undefined;
      const caseSensitive = (params.case_sensitive as boolean) ?? false;
      const glob = params.glob as string | undefined;
      const maxResults = (params.max_results as number) ?? 100;
      const contextLines = (params.context_lines as number) ?? 0;

      const regex = new RegExp(pattern, caseSensitive ? 'gm' : 'gim');
      const results: string[] = [];
      const maxFileSize = 5 * 1024 * 1024;

      function searchFile(fp: string): void {
        if (results.length >= maxResults) return;
        try {
          const stat = statSync(fp);
          if (stat.size > maxFileSize) return;
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (regex.test(lines[i])) {
              regex.lastIndex = 0;
              const lineNum = i + 1;
              if (contextLines > 0) {
                const from = Math.max(0, i - contextLines);
                const to = Math.min(lines.length, i + contextLines + 1);
                for (let j = from; j < to; j++) {
                  results.push(`${fp}:${j + 1}:${lines[j]}`);
                }
              } else {
                results.push(`${fp}:${lineNum}:${lines[i]}`);
              }
            }
          }
        } catch { /* skip */ }
      }

      if (filePath) {
        const abs = resolve(filePath);
        if (existsSync(abs)) searchFile(abs);
      } else if (dirPath) {
        const fg = await import('fast-glob');
        const pattern = glob ? `**/${glob}` : '**/*';
        const files = await fg.default(pattern, {
          cwd: resolve(dirPath),
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
        for (const f of files) {
          if (results.length >= maxResults) break;
          searchFile(f);
        }
      }

      return {
        success: true,
        output: results.join('\n') || '未找到匹配结果',
        metadata: { matches: results.length, maxResults },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
