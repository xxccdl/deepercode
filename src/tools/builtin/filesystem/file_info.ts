import { statSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const file_info: Tool = {
  name: 'file_info',
  description: '获取文件元信息（大小、修改时间等）',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件绝对路径' },
    },
    required: ['file_path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }
      const stat = statSync(filePath);
      const info = {
        name: basename(filePath),
        path: filePath,
        size: stat.size,
        sizeFormatted: formatSize(stat.size),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        isSymlink: stat.isSymbolicLink(),
        created: stat.birthtime.toISOString(),
        modified: stat.mtime.toISOString(),
        accessed: stat.atime.toISOString(),
        permissions: stat.mode.toString(8).slice(-3),
        readable: true,
        writable: true,
      };
      return { success: true, output: JSON.stringify(info, null, 2), metadata: info };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
