import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const batch_write: Tool = {
  name: 'batch_write',
  description: '批量写入多个文件，自动创建父目录，跳过空内容文件',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' },
          },
        },
        description: '文件列表 [{file_path, content}]',
      },
    },
    required: ['files'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const files = params.files as { file_path: string; content: string }[];
      if (!files || !files.length) {
        return { success: false, error: '文件列表为空', output: '' };
      }
      const results: string[] = [];
      const skipped: string[] = [];
      for (const f of files) {
        const abs = resolve(f.file_path);
        const content = f.content || '';
        if (!content.trim()) {
          skipped.push(abs);
          continue;
        }
        if (content.length > 524_288) {
          skipped.push(`${abs} (内容过大)`);
          continue;
        }
        const dir = dirname(abs);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        await writeFile(abs, content, 'utf-8');
        results.push(abs);
      }
      let output = `已写入 ${results.length} 个文件`;
      if (skipped.length > 0) output += `，跳过 ${skipped.length} 个(空内容)`;
      if (results.length > 0) output += ':\n' + results.join('\n');
      return {
        success: results.length > 0,
        output,
        metadata: { count: results.length, skipped: skipped.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
