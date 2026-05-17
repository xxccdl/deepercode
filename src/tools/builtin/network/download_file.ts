import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Tool } from '../../tool-types.js';

export const download_file: Tool = {
  name: 'download_file',
  description: '下载文件到本地',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '下载 URL' },
      file_path: { type: 'string', description: '保存路径' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['url', 'file_path'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const filePath = resolve(params.file_path as string);
      const timeout = (params.timeout_ms as number) ?? 60000;

      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status}: ${res.statusText}`, output: '' };
        }
        if (!res.body) {
          return { success: false, error: '响应体为空', output: '' };
        }
        const ws = createWriteStream(filePath);
        await pipeline(res.body as unknown as NodeJS.ReadableStream, ws);
        const stat = await import('node:fs').then(m => m.statSync(filePath));
        return {
          success: true,
          output: `下载完成: ${filePath} (${formatSize(stat.size)})`,
          metadata: { url, path: filePath, size: stat.size },
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
