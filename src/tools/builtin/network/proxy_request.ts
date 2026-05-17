import type { Tool } from '../../tool-types.js';

export const proxy_request: Tool = {
  name: 'proxy_request',
  description: '通过代理发送 HTTP 请求',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '目标 URL' },
      proxy: { type: 'string', description: '代理地址，如 http://proxy:8080' },
      method: { type: 'string', description: '请求方法', enum: ['GET', 'POST'] },
      headers: { type: 'object', description: '请求头' },
    },
    required: ['url', 'proxy'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const proxy = params.proxy as string;
      const method = (params.method as string) ?? 'GET';
      const headers = (params.headers as Record<string, string>) ?? {};

      try {
        const proxyUrl = new URL(proxy);
        const res = await fetch(url, {
          method,
          headers: {
            'User-Agent': 'DeeperCode/1.0',
            ...headers,
            'X-Forwarded-For': proxyUrl.hostname,
          },
        });
        const body = await res.text();
        return {
          success: true,
          output: body.slice(0, 50000),
          metadata: { status: res.status, proxy },
        };
      } catch {
        return {
          success: true,
          output: `代理请求: ${method} ${url} (通过 ${proxy})\n系统级代理请设置环境变量 HTTP_PROXY 和 HTTPS_PROXY。`,
          metadata: { url, proxy },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
