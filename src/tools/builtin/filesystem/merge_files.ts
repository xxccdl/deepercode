import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const merge_files: Tool = {
  name: 'merge_files',
  description: '合并多个文件内容写入目标文件',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_paths: { type: 'array', items: { type: 'string' }, description: '源文件路径列表' },
      output: { type: 'string', description: '输出文件路径' },
      separator: { type: 'string', description: '文件间分隔符，默认换行' },
    },
    required: ['file_paths', 'output'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const paths = params.file_paths as string[];
      const output = resolve(params.output as string);
      const sep = (params.separator as string) ?? '\n';
      const parts: string[] = [];
      for (const p of paths) {
        const abs = resolve(p);
        if (!existsSync(abs)) {
          return { success: false, error: `文件不存在: ${abs}`, output: '' };
        }
        parts.push(readFileSync(abs, 'utf-8'));
      }
      const merged = parts.join(sep);
      writeFileSync(output, merged, 'utf-8');
      return {
        success: true,
        output: `已合并 ${paths.length} 个文件到: ${output}`,
        metadata: { count: paths.length, size: merged.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
