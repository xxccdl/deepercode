import { killProcess } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const kill_terminal: Tool = {
  name: 'kill_terminal',
  description: '强制关闭后台终端',
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
      const ok = killProcess(terminalId);
      if (!ok) {
        return { success: false, error: `终端不存在: ${terminalId}`, output: '' };
      }
      return { success: true, output: `已关闭终端: ${terminalId}`, metadata: { terminalId } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
