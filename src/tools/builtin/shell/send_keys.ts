import { getProcess } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const send_keys: Tool = {
  name: 'send_keys',
  description: '检查后台终端是否可写入',
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
      const entry = getProcess(terminalId);
      if (!entry || !entry.alive) {
        return { success: false, error: `终端不可用: ${terminalId}`, output: '' };
      }
      if (!entry.proc.stdin) {
        return { success: false, error: `终端 stdin 不可写: ${terminalId}`, output: '' };
      }
      return {
        success: true,
        output: `终端 "${terminalId}" 就绪，可通过 send_text 发送文本`,
        metadata: { terminalId, pid: entry.proc.pid },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
