import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const encrypt_file: Tool = {
  name: 'encrypt_file',
  description: '加密文件内容 (AES-256-CBC)',
  category: 'security',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要加密的文件路径' },
      output: { type: 'string', description: '加密输出文件路径' },
      password: { type: 'string', description: '加密密钥' },
      algorithm: { type: 'string', description: '加密算法', enum: ['aes-256-cbc', 'aes-128-cbc'] },
    },
    required: ['file_path', 'output'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const output = resolve(params.output as string);
      const password = params.password as string | undefined;
      const algorithm = (params.algorithm as string) ?? 'aes-256-cbc';

      if (!existsSync(filePath)) return { success: false, error: `文件不存在: ${filePath}`, output: '' };

      const crypto = await import('node:crypto');
      const content = readFileSync(filePath);

      const key = crypto.scryptSync(password || 'default-secret-key', 'salt', algorithm === 'aes-256-cbc' ? 32 : 16);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      const encrypted = Buffer.concat([iv, cipher.update(content), cipher.final()]);

      const outDir = dirname(output);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(output, encrypted);

      return {
        success: true,
        output: `文件已加密: ${filePath} → ${output}`,
        metadata: { algorithm, encryptedSize: encrypted.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
