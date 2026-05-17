import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const regex_find: Tool = {
  name: 'regex_find',
  description: '使用正则表达式搜索并替换文件内容',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '正则表达式' },
      replacement: { type: 'string', description: '替换字符串' },
      file_path: { type: 'string', description: '文件路径' },
      dir_path: { type: 'string', description: '目录路径' },
      file_pattern: { type: 'string', description: '文件匹配模式' },
      case_sensitive: { type: 'boolean', description: '是否区分大小写' },
      dry_run: { type: 'boolean', description: '仅预览不实际修改' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: ['pattern'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const regPattern = params.pattern as string;
      const replacement = (params.replacement as string) ?? '';
      const filePath = params.file_path as string | undefined;
      const dirPath = params.dir_path as string | undefined;
      const filePattern = (params.file_pattern as string) ?? '**/*';
      const caseSensitive = (params.case_sensitive as boolean) ?? false;
      const dryRun = (params.dry_run as boolean) ?? true;
      const maxResults = (params.max_results as number) ?? 100;

      const regex = new RegExp(regPattern, caseSensitive ? 'gm' : 'gim');
      const results: string[] = [];
      const maxFileSize = 2 * 1024 * 1024;

      async function processFile(fp: string): Promise<void> {
        if (results.length >= maxResults) return;
        try {
          const stat = await import('node:fs').then(m => m.statSync(fp));
          if (stat.size > maxFileSize) return;
          let content = readFileSync(fp, 'utf-8');
          if (!regex.test(content)) return;
          regex.lastIndex = 0;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (regex.test(lines[i])) {
              regex.lastIndex = 0;
              const newLine = lines[i].replace(new RegExp(regPattern, caseSensitive ? 'gm' : 'gim'), replacement.replace(/\$/g, '$$$$'));
              results.push(`${fp}:${i + 1}: - ${lines[i].trim()}\n  + ${newLine.trim()}`);
            }
          }
          if (!dryRun) {
            regex.lastIndex = 0;
            content = content.replace(new RegExp(regPattern, caseSensitive ? 'gm' : 'gim'), replacement.replace(/\$/g, '$$$$'));
            writeFileSync(fp, content, 'utf-8');
          }
        } catch { /* skip */ }
      }

      if (filePath) {
        const abs = resolve(filePath);
        if (existsSync(abs)) await processFile(abs);
      } else if (dirPath) {
        const fg = await import('fast-glob');
        const files = await fg.default(filePattern, {
          cwd: resolve(dirPath),
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
        for (const f of files) {
          if (results.length >= maxResults) break;
          await processFile(f);
        }
      }

      const prefix = dryRun ? '[预览模式] ' : '[已修改] ';
      return {
        success: true,
        output: results.length > 0 ? prefix + `找到 ${results.length} 处匹配:\n${results.join('\n')}` : '未找到匹配',
        metadata: { matches: results.length, dryRun },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
