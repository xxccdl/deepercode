import type { Tool } from '../../tool-types.js';

export const api_call: Tool = {
  name: 'api_call',
  description: '调用 REST API 并处理响应',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'API URL' },
      method: { type: 'string', description: 'HTTP 方法', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      headers: { type: 'object', description: '请求头' },
      body: { type: 'string', description: '请求体 (JSON)' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
      auth_type: { type: 'string', description: '认证类型: none, bearer, basic, api_key', enum: ['none', 'bearer', 'basic', 'api_key'] },
      auth_value: { type: 'string', description: '认证凭据（token 或 key）' },
    },
    required: ['url'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const method = (params.method as string) ?? 'GET';
      const headers = (params.headers as Record<string, string>) ?? {};
      const body = params.body as string | undefined;
      const timeout = (params.timeout_ms as number) ?? 30000;
      const authType = (params.auth_type as string) ?? 'none';
      const authValue = params.auth_value as string | undefined;

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DeeperCode/1.0',
        ...headers,
      };

      if (authType === 'bearer' && authValue) {
        fetchHeaders['Authorization'] = `Bearer ${authValue}`;
      } else if (authType === 'basic' && authValue) {
        const encoded = Buffer.from(authValue).toString('base64');
        fetchHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (authType === 'api_key' && authValue) {
        fetchHeaders['X-API-Key'] = authValue;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          method,
          headers: fetchHeaders,
          body: method !== 'GET' ? body : undefined,
          signal: controller.signal,
        });

        const responseText = await res.text();
        let parsed;
        try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }
        const output = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);

        return {
          success: res.ok,
          output: output.slice(0, 50000),
          metadata: {
            status: res.status,
            statusText: res.statusText,
            contentType: res.headers.get('content-type'),
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
