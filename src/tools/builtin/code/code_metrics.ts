import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const code_metrics: Tool = {
  name: 'code_metrics',
  description: '计算代码度量指标（行数、复杂度等）',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      dir_path: { type: 'string', description: '目录路径' },
      file_path: { type: 'string', description: '文件路径' },
      glob: { type: 'string', description: '文件过滤' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const dirPath = params.dir_path as string | undefined;
      const filePath = params.file_path as string | undefined;
      const glob = (params.glob as string) ?? '**/*.{ts,js,tsx,jsx,py}';

      let target: string;
      let files: string[];

      if (filePath) {
        target = resolve(filePath);
        files = [target];
      } else {
        target = dirPath ? resolve(dirPath) : process.cwd();
        const fg = await import('fast-glob');
        files = await fg.default(glob, {
          cwd: target,
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
      }

      let totalLines = 0;
      let totalCode = 0;
      let totalComments = 0;
      let totalBlank = 0;
      let totalFiles = 0;
      const fileMetrics: Record<string, unknown>[] = [];

      for (const fp of files.slice(0, 200)) {
        try {
          const stat = statSync(fp);
          if (stat.size > 1048576) continue;
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          let code = 0, comments = 0, blank = 0;

          let inBlockComment = false;
          for (const line of lines) {
            if (line.trim() === '') { blank++; continue; }
            if (inBlockComment) {
              comments++;
              if (line.includes('*/')) inBlockComment = false;
              continue;
            }
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) { comments++; continue; }
            if (trimmed.startsWith('/*')) {
              comments++;
              if (!trimmed.includes('*/')) inBlockComment = true;
              continue;
            }
            code++;
          }

          totalLines += lines.length;
          totalCode += code;
          totalComments += comments;
          totalBlank += blank;
          totalFiles++;

          fileMetrics.push({
            file: relative(target, fp),
            lines: lines.length,
            code,
            comments,
            blank,
          });
        } catch { /* skip */ }
      }

      const summary = [
        `代码度量报告 (${totalFiles} 文件)`,
        `总行数: ${totalLines}`,
        `代码行: ${totalCode}`,
        `注释行: ${totalComments}`,
        `空行: ${totalBlank}`,
        `注释率: ${totalLines > 0 ? (totalComments / totalLines * 100).toFixed(1) : 0}%`,
        '',
        '前10文件:',
        ...fileMetrics.slice(0, 10).map(
          m => `  ${m.file}: ${m.lines} 行 (代码:${m.code} 注释:${m.comments} 空:${m.blank})`
        ),
      ];

      return { success: true, output: summary.join('\n'), metadata: { totalFiles, totalLines, totalCode } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
