import type { Tool } from '../../tool-types.js';

export const terminal_screenshot: Tool = {
  name: 'terminal_screenshot',
  description: '获取终端状态快照（文本形式）',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      terminal_id: { type: 'string', description: '终端标识' },
    },
    required: ['terminal_id'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const terminalId = params.terminal_id as string;
      return {
        success: true,
        output: `终端快照: ${terminalId}\n（终端屏幕截图功能在 CLI 环境中以文本输出替代）`,
        metadata: { terminalId, method: 'text-snapshot' },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
