import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const hash_generate: Tool = {
  name: 'hash_generate',
  description: '生成文件或字符串的哈希值',
  category: 'security',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '要哈希的字符串' },
      file_path: { type: 'string', description: '文件路径' },
      algorithm: { type: 'string', description: '算法', enum: ['sha256', 'sha512', 'md5'] },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const content = params.content as string | undefined;
      const filePath = params.file_path as string | undefined;
      const algorithm = (params.algorithm as string) ?? 'sha256';

      let hash: string;
      if (filePath) {
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        const fileContent = readFileSync(abs);
        hash = createHash(algorithm).update(fileContent).digest('hex');
      } else if (content) {
        hash = createHash(algorithm).update(content, 'utf-8').digest('hex');
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      return {
        success: true,
        output: `${algorithm.toUpperCase()}: ${hash}`,
        metadata: { algorithm, hash },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
