import { renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const move_file: Tool = {
  name: 'move_file',
  description: '移动或重命名文件',
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
      const { mkdirSync } = await import('node:fs');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      renameSync(source, dest);
      return { success: true, output: `已移动: ${source} -> ${dest}` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
