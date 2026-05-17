import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const text_search: Tool = {
  name: 'text_search',
  description: '全文搜索，在文件内容中查找文本',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '搜索文本' },
      dir_path: { type: 'string', description: '搜索目录' },
      file_pattern: { type: 'string', description: '文件匹配模式，如 *.md' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['text', 'dir_path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const text = params.text as string;
      const dirPath = resolve(params.dir_path as string);
      const filePattern = (params.file_pattern as string) ?? '**/*';
      const maxResults = (params.max_results as number) ?? 100;

      const fg = await import('fast-glob');
      const files = await fg.default(filePattern, {
        cwd: dirPath,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '*.min.*', '*.jpg', '*.png', '*.gif', '*.ico', '*.svg'],
        onlyFiles: true,
      });

      const results: string[] = [];
      const maxFileSize = 2 * 1024 * 1024;

      for (const fp of files) {
        if (results.length >= maxResults) break;
        try {
          const stat = await import('node:fs').then(m => m.statSync(fp));
          if (stat.size > maxFileSize) continue;
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (lines[i].includes(text)) {
              results.push(`${fp}:${i + 1}:${lines[i].trim()}`);
            }
          }
        } catch { /* skip */ }
      }

      return {
        success: true,
        output: results.join('\n') || '未找到匹配结果',
        metadata: { matches: results.length, dir: dirPath },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
