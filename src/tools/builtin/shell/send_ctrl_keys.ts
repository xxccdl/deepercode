import { sendSignal } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const send_ctrl_keys: Tool = {
  name: 'send_ctrl_keys',
  description: '向后台终端发送控制信号 (Ctrl+C=SIGINT, Ctrl+D=关闭stdin)',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      terminal_id: { type: 'string', description: '终端标识' },
      signal: { type: 'string', enum: ['ctrl_c', 'ctrl_d', 'ctrl_z'], description: 'ctrl_c=SIGINT, ctrl_d=关闭stdin, ctrl_z=SIGTSTP' },
    },
    required: ['terminal_id', 'signal'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const terminalId = params.terminal_id as string;
      const signal = params.signal as string;

      switch (signal) {
        case 'ctrl_c':
          sendSignal(terminalId, 'SIGINT');
          return { success: true, output: `已发送 Ctrl+C 到终端: ${terminalId}`, metadata: { terminalId }, };
        case 'ctrl_d': {
          const { getProcess } = await import('./process-pool.js');
          const entry = getProcess(terminalId);
          if (entry?.proc.stdin) { entry.proc.stdin.end(); }
          return { success: true, output: `已发送 Ctrl+D 到终端: ${terminalId}`, metadata: { terminalId }, };
        }
        case 'ctrl_z':
          sendSignal(terminalId, 'SIGTERM');
          return { success: true, output: `已发送 Ctrl+Z 到终端: ${terminalId}`, metadata: { terminalId }, };
        default:
          return { success: false, error: `未知信号: ${signal}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
