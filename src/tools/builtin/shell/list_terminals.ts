import { listProcesses, readOutput as poolRead } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const list_terminals: Tool = {
  name: 'list_terminals',
  description: '列出所有后台终端及最近输出',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute() {
    try {
      const entries = listProcesses();
      if (entries.length === 0) {
        return { success: true, output: '没有后台终端' };
      }
      let out = `后台终端 (${entries.length}):\n`;
      for (const e of entries) {
        const status = e.alive ? `运行 ${e.runningSec}s` : '已结束';
        out += `  ${e.id}  PID:${e.pid ?? '-'}  ${e.command}\n`;
        out += `  ${status} | 输出:${e.outputLen}B | ${e.outputTail}\n\n`;
      }
      return { success: true, output: out, metadata: { entries } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

export const read_terminal: Tool = {
  name: 'read_terminal',
  description: '读取后台终端的输出内容',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      terminal_id: { type: 'string', description: '终端标识' },
      tail: { type: 'boolean', description: '仅显示末尾输出' },
    },
    required: ['terminal_id'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const terminalId = params.terminal_id as string;
      const tail = (params.tail as boolean) ?? true;
      const output = poolRead(terminalId, tail);
      if (output === null) {
        return { success: false, error: `终端不存在: ${terminalId}`, output: '' };
      }
      return { success: true, output, metadata: { terminalId, tail } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
