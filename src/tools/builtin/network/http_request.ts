import type { Tool } from '../../tool-types.js';

export const http_request: Tool = {
  name: 'http_request',
  description: '通用 HTTP 请求（支持 GET/POST/PUT/DELETE/PATCH）',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '请求 URL' },
      method: { type: 'string', description: '请求方法', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      headers: { type: 'object', description: '请求头' },
      body: { type: 'string', description: '请求体' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['url'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const url = params.url as string;
      const method = (params.method as string) ?? 'GET';
      const headers = (params.headers as Record<string, string>) ?? {};
      const body = params.body as string | undefined;
      const timeout = (params.timeout_ms as number) ?? 30000;

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'DeeperCode/1.0',
        ...headers,
      };

      const fetchOptions: RequestInit = { method, headers: fetchHeaders };
      if (body && method !== 'GET') {
        fetchOptions.body = body;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
        const text = await res.text();
        return {
          success: res.ok,
          output: text.slice(0, 50000),
          metadata: {
            status: res.status,
            statusText: res.statusText,
            contentType: res.headers.get('content-type'),
            length: text.length,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
