import { sendToStdin } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const send_text: Tool = {
  name: 'send_text',
  description: '向后台终端发送文本输入',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      terminal_id: { type: 'string', description: '终端标识' },
      text: { type: 'string', description: '要发送的文本' },
    },
    required: ['terminal_id', 'text'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const terminalId = params.terminal_id as string;
      const text = params.text as string;
      const ok = sendToStdin(terminalId, text);
      if (!ok) {
        return { success: false, error: `无法发送到终端: ${terminalId}`, output: '' };
      }
      return {
        success: true,
        output: `已发送文本到终端: ${terminalId}`,
        metadata: { terminalId, length: text.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
