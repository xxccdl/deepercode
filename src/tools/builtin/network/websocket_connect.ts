import type { Tool } from '../../tool-types.js';

let activeWs: import('ws').WebSocket | null = null;

export const websocket_connect: Tool = {
  name: 'websocket_connect',
  description: '建立 WebSocket 连接',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'WebSocket URL (ws:// 或 wss://)' },
      message: { type: 'string', description: '要发送的消息' },
      timeout_ms: { type: 'number', description: '连接超时毫秒数' },
    },
    required: ['url'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const message = params.message as string | undefined;
      const timeout = (params.timeout_ms as number) ?? 10000;

      const WS = await import('ws');
      const ws = new WS.WebSocket(url);

      const result = await new Promise<{ success: boolean; output: string }>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket 连接超时'));
        }, timeout);

        let response = '';

        ws.on('open', () => {
          response += `已连接: ${url}\n`;
          if (message) {
            ws.send(message);
            response += `已发送: ${message}\n`;
          }
        });

        ws.on('message', (data: Buffer) => {
          response += `收到: ${data.toString('utf-8')}\n`;
          clearTimeout(timer);
          ws.close();
          resolve({ success: true, output: response });
        });

        ws.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });

        ws.on('close', () => {
          clearTimeout(timer);
          if (response) {
            resolve({ success: true, output: response + '\n连接已关闭' });
          }
        });
      });

      return result;
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
