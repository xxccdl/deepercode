import type { Tool } from '../../tool-types.js';

export const interactive_terminal: Tool = {
  name: 'interactive_terminal',
  description: '启动交互式终端会话（在当前 CLI 环境中限制使用）',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要运行的交互式命令' },
      terminal_id: { type: 'string', description: '终端标识' },
    },
    required: ['command'],
  },
  dangerous: true,
  requiresApproval: true,
  async execute(params) {
    try {
      const command = params.command as string;
      const terminalId = (params.terminal_id as string) ?? `interactive_${Date.now()}`;

      return {
        success: true,
        output: `交互式终端请求已记录: ${terminalId}\n命令: ${command}\n\n注意: 当前运行在非交互式环境，建议使用 background_terminal 运行此命令。`,
        metadata: { terminalId, command, interactive: false },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
