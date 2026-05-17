import { readFileSync, existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const read_file: Tool = {
  name: 'read_file',
  description: '读取文件内容，支持指定行范围和偏移量，最大支持1万行',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件绝对路径' },
      offset: { type: 'number', description: '起始行号（从1开始）' },
      limit: { type: 'number', description: '读取行数（最大10000）' },
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
      const statSync = await import('node:fs').then(m => m.statSync);
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        return { success: false, error: `路径是目录，不是文件: ${filePath}`, output: '' };
      }
      const maxSize = 20 * 1024 * 1024;
      if (stat.size > maxSize) {
        return { success: false, error: `文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，限制 ${maxSize / 1024 / 1024}MB`, output: '' };
      }
      let raw = readFileSync(filePath, 'utf-8');
      const offset = (params.offset as number) ?? 1;
      let limit = params.limit as number | undefined;
      if (limit !== undefined) limit = Math.min(limit, 10000);
      if (offset > 1 || limit !== undefined) {
        const lines = raw.split('\n');
        const start = Math.max(0, offset - 1);
        const end = limit !== undefined ? Math.min(start + limit, lines.length) : lines.length;
        raw = lines.slice(start, end).join('\n');
      } else {
        const lines = raw.split('\n');
        if (lines.length > 10000) {
          raw = lines.slice(0, 10000).join('\n') + `\n... (共${lines.length}行，仅显示前10000行)`;
        }
      }
      return { success: true, output: raw, metadata: { size: stat.size, path: normalize(filePath) } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
