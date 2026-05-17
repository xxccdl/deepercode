import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const analyze_deps: Tool = {
  name: 'analyze_deps',
  description: '分析文件依赖关系',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '入口文件路径' },
      dir_path: { type: 'string', description: '分析目录' },
      depth: { type: 'number', description: '分析深度' },
      max_files: { type: 'number', description: '最大分析文件数' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = params.file_path as string | undefined;
      const dirPath = params.dir_path as string | undefined;
      const depth = (params.depth as number) ?? 1;
      const maxFiles = (params.max_files as number) ?? 50;

      const fg = await import('fast-glob');
      let files: string[];
      if (filePath) {
        files = [resolve(filePath)];
      } else {
        const target = dirPath ? resolve(dirPath) : process.cwd();
        files = await fg.default('**/*.{ts,js,tsx,jsx}', {
          cwd: target,
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
        files = files.slice(0, maxFiles);
      }

      const importRegex = /from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|import\(['"]([^'"]+)['"]\)/g;
      const results: { file: string; imports: string[] }[] = [];

      for (const fp of files) {
        try {
          const content = readFileSync(fp, 'utf-8');
          const deps: string[] = [];
          let match;
          while ((match = importRegex.exec(content)) !== null) {
            const dep = match[1] || match[2] || match[3];
            deps.push(dep);
          }
          results.push({ file: fp, imports: [...new Set(deps)] });
        } catch { /* skip */ }
      }

      const output = results.map(r =>
        `--- ${r.file} ---\n  ${r.imports.length > 0 ? r.imports.join('\n  ') : '(无外部依赖)'}`
      ).join('\n\n');

      return {
        success: true,
        output: output || '未找到依赖关系',
        metadata: { files: results.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
