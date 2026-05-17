import type { Tool } from '../../tool-types.js';

export const check_url: Tool = {
  name: 'check_url',
  description: '检查 URL 是否可达',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['url'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const url = params.url as string;
      const timeout = (params.timeout_ms as number) ?? 10000;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const start = Date.now();
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'DeeperCode/1.0' },
        });
        const elapsed = Date.now() - start;

        return {
          success: true,
          output: `${url} 可达 (HTTP ${res.status}, ${elapsed}ms)`,
          metadata: {
            url,
            status: res.status,
            statusText: res.statusText,
            responseTimeMs: elapsed,
            reachable: true,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      const message = (err as Error).message;
      const unreachable = message.includes('ENOTFOUND') || message.includes('ECONNREFUSED');
      return {
        success: !unreachable,
        output: `${params.url} ${unreachable ? '不可达' : '检查失败'}: ${message}`,
        error: message,
        metadata: { reachable: false },
      };
    }
  },
};
