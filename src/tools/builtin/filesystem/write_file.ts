import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const write_file: Tool = {
  name: 'write_file',
  description: '写入文件内容，自动创建父目录。最大 512KB。空内容会跳过写入。',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件绝对路径' },
      content: { type: 'string', description: '要写入的内容' },
      append: { type: 'boolean', description: '是否追加模式' },
    },
    required: ['file_path', 'content'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    const content = params.content as string;
    if (content.length > 524_288) {
      return { success: false, error: `内容过大 (${content.length}B, 最大 512KB)`, output: '' };
    }
    try {
      const filePath = resolve(params.file_path as string);
      const append = (params.append as boolean) ?? false;
      if (!content.trim() && !append) {
        return { success: false, error: `内容为空，跳过写入: ${filePath}`, output: '' };
      }
      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (append) {
        await appendFile(filePath, content, 'utf-8');
      } else {
        await writeFile(filePath, content, 'utf-8');
      }
      const lineCount = content.split('\n').length;
      return { success: true, output: `文件已${append ? '追加' : '写入'}: ${filePath} (${lineCount}行)` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
