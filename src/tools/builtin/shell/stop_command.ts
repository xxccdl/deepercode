import { runningProcesses } from './run_async.js';
import type { Tool } from '../../tool-types.js';

export const stop_command: Tool = {
  name: 'stop_command',
  description: '终止正在执行的异步命令',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: '任务标识' },
      signal: { type: 'string', description: '终止信号: SIGTERM, SIGKILL', enum: ['SIGTERM', 'SIGKILL'] },
    },
    required: ['task_id'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const taskId = params.task_id as string;
      const signal = (params.signal as string) ?? 'SIGTERM';
      const proc = runningProcesses.get(taskId);

      if (!proc) {
        return { success: false, error: `任务不存在或已完成: ${taskId}`, output: '' };
      }

      if (signal === 'SIGKILL') {
        proc.kill('SIGKILL');
      } else {
        proc.kill('SIGTERM');
      }

      runningProcesses.delete(taskId);
      return { success: true, output: `已终止任务: ${taskId} (信号: ${signal})` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
