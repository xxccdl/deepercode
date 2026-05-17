import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const copy_file: Tool = {
  name: 'copy_file',
  description: '复制文件',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      source: { type: 'string', description: '源文件路径' },
      destination: { type: 'string', description: '目标文件路径' },
    },
    required: ['source', 'destination'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const source = resolve(params.source as string);
      const dest = resolve(params.destination as string);
      if (!existsSync(source)) {
        return { success: false, error: `源文件不存在: ${source}`, output: '' };
      }
      const destDir = dirname(dest);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(source, dest);
      return { success: true, output: `已复制: ${source} -> ${dest}` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
