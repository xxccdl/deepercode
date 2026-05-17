import type { Tool } from '../../tool-types.js';

export const jwt_decode: Tool = {
  name: 'jwt_decode',
  description: '解码 JWT Token（不验证签名）',
  category: 'security',
  parameters: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'JWT Token 字符串' },
    },
    required: ['token'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const token = params.token as string;
      const parts = token.split('.');

      if (parts.length !== 3) {
        return { success: false, error: '无效的 JWT 格式（需要3部分）', output: '' };
      }

      const decodeBase64 = (str: string): string => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64').toString('utf-8');
      };

      const header = JSON.parse(decodeBase64(parts[0]));
      const payload = JSON.parse(decodeBase64(parts[1]));

      const output = [
        '=== JWT Token 解码 ===',
        '',
        '--- Header ---',
        JSON.stringify(header, null, 2),
        '',
        '--- Payload ---',
        JSON.stringify(payload, null, 2),
        '',
        payload.exp ? `过期时间: ${new Date(payload.exp * 1000).toISOString()}${Date.now() > payload.exp * 1000 ? ' (已过期)' : ''}` : '',
        payload.iat ? `签发时间: ${new Date(payload.iat * 1000).toISOString()}` : '',
        '',
        '注意: 签名未验证，仅解码。',
      ].filter(Boolean).join('\n');

      return { success: true, output, metadata: { ...header, sub: payload.sub } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
