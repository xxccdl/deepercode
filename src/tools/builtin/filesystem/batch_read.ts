import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const batch_read: Tool = {
  name: 'batch_read',
  description: '批量读取多个文件',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_paths: { type: 'array', items: { type: 'string' }, description: '文件路径列表' },
      max_size_per_file: { type: 'number', description: '单文件最大字节数' },
    },
    required: ['file_paths'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const paths = params.file_paths as string[];
      const maxSize = (params.max_size_per_file as number) ?? 1024 * 1024;
      const results: Record<string, { content: string; error?: string }> = {};
      for (const p of paths) {
        const abs = resolve(p);
        try {
          if (!existsSync(abs)) {
            results[p] = { content: '', error: '文件不存在' };
            continue;
          }
          const stat = await import('node:fs').then(m => m.statSync(abs));
          if (stat.size > maxSize) {
            results[p] = { content: '', error: `文件过大 (${stat.size} > ${maxSize})` };
            continue;
          }
          results[p] = { content: readFileSync(abs, 'utf-8') };
        } catch (e) {
          results[p] = { content: '', error: (e as Error).message };
        }
      }
      const output = Object.entries(results)
        .map(([path, r]) => {
          if (r.error) return `--- ${path} (ERROR: ${r.error}) ---`;
          return `--- ${path} ---\n${r.content}`;
        })
        .join('\n\n');
      return {
        success: true,
        output,
        metadata: { files: paths.length, read: Object.values(results).filter(r => !r.error).length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
