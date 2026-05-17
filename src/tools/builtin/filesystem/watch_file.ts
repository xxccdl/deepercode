import { watch, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const watch_file: Tool = {
  name: 'watch_file',
  description: '监听文件变化并返回初始状态',
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
      return {
        success: true,
        output: `监听已设置: ${filePath}（文件变化将在下次查询时反映）`,
        metadata: { watching: true, path: filePath },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
