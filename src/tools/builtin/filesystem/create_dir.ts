import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const create_dir: Tool = {
  name: 'create_dir',
  description: '创建目录（递归创建父目录）',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      dir_path: { type: 'string', description: '目录绝对路径' },
    },
    required: ['dir_path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const dirPath = resolve(params.dir_path as string);
      if (existsSync(dirPath)) {
        return { success: true, output: `目录已存在: ${dirPath}` };
      }
      mkdirSync(dirPath, { recursive: true });
      return { success: true, output: `目录已创建: ${dirPath}` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
