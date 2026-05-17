import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const decrypt_file: Tool = {
  name: 'decrypt_file',
  description: '解密文件内容 (AES-256-CBC)',
  category: 'security',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要解密的文件路径' },
      output: { type: 'string', description: '解密输出文件路径' },
      password: { type: 'string', description: '解密密钥' },
      algorithm: { type: 'string', description: '算法', enum: ['aes-256-cbc', 'aes-128-cbc'] },
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
      const encrypted = readFileSync(filePath);

      const iv = encrypted.subarray(0, 16);
      const data = encrypted.subarray(16);

      const key = crypto.scryptSync(password || 'default-secret-key', 'salt', algorithm === 'aes-256-cbc' ? 32 : 16);
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

      const outDir = dirname(output);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(output, decrypted);

      return {
        success: true,
        output: `文件已解密: ${filePath} → ${output}`,
        metadata: { algorithm, decryptedSize: decrypted.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
