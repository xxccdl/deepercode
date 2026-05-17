import { readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const list_dir: Tool = {
  name: 'list_dir',
  description: '列出目录内容',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      dir_path: { type: 'string', description: '目录绝对路径' },
      recursive: { type: 'boolean', description: '是否递归列出' },
      max_depth: { type: 'number', description: '递归最大深度' },
    },
    required: ['dir_path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const dirPath = resolve(params.dir_path as string);
      const recursive = (params.recursive as boolean) ?? false;
      const maxDepth = (params.max_depth as number) ?? 3;
      if (!existsSync(dirPath)) {
        return { success: false, error: `目录不存在: ${dirPath}`, output: '' };
      }
      const { statSync } = await import('node:fs');
      const lines: string[] = [];
      function walk(dir: string, depth: number, prefix: string) {
        if (depth > maxDepth) return;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const isDir = entry.isDirectory();
            lines.push(`${prefix}${isDir ? '📁' : '📄'} ${entry.name}`);
            if (isDir && recursive) {
              walk(join(dir, entry.name), depth + 1, prefix + '  ');
            }
          }
        } catch {
          lines.push(`${prefix}权限不足`);
        }
      }
      walk(dirPath, 1, '');
      return { success: true, output: lines.join('\n'), metadata: { path: dirPath, entries: lines.length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
