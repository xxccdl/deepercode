import { startBgProcess } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const background_terminal: Tool = {
  name: 'background_terminal',
  description: '在后台终端中运行持久进程 (npm run dev, 服务器等)。启动后立即返回，可用 read_terminal 查看输出、list_terminals 查看状态、kill_terminal 终止。',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要运行的命令，如 npm run dev' },
      cwd: { type: 'string', description: '工作目录' },
      terminal_id: { type: 'string', description: '终端标识 (可选，自动生成)' },
      env: { type: 'object', description: '额外环境变量' },
    },
    required: ['command'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const command = params.command as string;
      const cwd = params.cwd as string | undefined;
      const terminalId = params.terminal_id as string | undefined;
      const env = params.env as Record<string, string> | undefined;

      const { terminalId: tid, pid } = startBgProcess({ command, cwd, terminalId, env });

      return {
        success: true,
        output: `后台终端已启动\n  ID: ${tid}\n  PID: ${pid}\n  命令: ${command}\n  目录: ${cwd || process.cwd()}\n\n启动后等待 1-2 秒即可用 read_terminal 查看输出。`,
        metadata: { terminalId: tid, pid },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
