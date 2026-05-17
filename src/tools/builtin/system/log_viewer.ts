import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const log_viewer: Tool = {
  name: 'log_viewer',
  description: '查看和管理日志文件',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: read, tail, search, clear', enum: ['read', 'tail', 'search', 'clear'] },
      file_path: { type: 'string', description: '日志文件路径' },
      lines: { type: 'number', description: '读取行数（tail 模式）' },
      query: { type: 'string', description: '搜索关键词' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const action = params.action as string;
      const filePath = params.file_path as string | undefined;
      const lineCount = (params.lines as number) ?? 50;
      const query = params.query as string | undefined;

      if (action !== 'clear' && !filePath) {
        const defaultLogs = ['npm-debug.log', 'yarn-error.log', '.log', 'logs/'];
        const cwd = process.cwd();
        const found = defaultLogs.filter(f => existsSync(resolve(cwd, f)));
        return {
          success: true,
          output: `请指定 file_path。项目目录中的日志文件:\n${found.length > 0 ? found.join('\n') : '  (未找到)'}`,
        };
      }

      const abs = resolve(filePath!);

      if (action === 'clear') {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(abs, '', 'utf-8');
        return { success: true, output: `日志已清空: ${abs}` };
      }

      if (!existsSync(abs)) {
        return { success: false, error: `日志文件不存在: ${abs}`, output: '' };
      }

      const content = readFileSync(abs, 'utf-8');
      const allLines = content.split('\n');

      switch (action) {
        case 'read': {
          const sub = allLines.slice(0, lineCount).join('\n');
          return {
            success: true,
            output: sub,
            metadata: { lines: allLines.length, shown: Math.min(lineCount, allLines.length) },
          };
        }
        case 'tail': {
          const sub = allLines.slice(-lineCount).join('\n');
          return {
            success: true,
            output: `最后 ${Math.min(lineCount, allLines.length)} 行:\n${sub}`,
            metadata: { totalLines: allLines.length },
          };
        }
        case 'search': {
          if (!query) return { success: false, error: 'search 需要 query 参数', output: '' };
          const matches = allLines
            .map((line, i) => line.includes(query) ? `${i + 1}:${line.trim()}` : null)
            .filter(Boolean)
            .slice(0, 200);
          return {
            success: true,
            output: matches.join('\n') || '未找到匹配行',
            metadata: { matches: matches.length, totalLines: allLines.length },
          };
        }
        default:
          return { success: false, error: `不支持的操作: ${action}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
