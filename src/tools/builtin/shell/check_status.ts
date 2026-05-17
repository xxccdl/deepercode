import { runningProcesses } from './run_async.js';
import type { Tool } from '../../tool-types.js';

export const check_status: Tool = {
  name: 'check_status',
  description: '检查异步命令的执行状态',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: '任务标识' },
      show_all: { type: 'boolean', description: '显示所有运行中的任务' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const taskId = params.task_id as string | undefined;
      const showAll = (params.show_all as boolean) ?? false;

      if (showAll || !taskId) {
        const tasks = Array.from(runningProcesses.keys());
        return {
          success: true,
          output: tasks.length > 0
            ? `运行中的任务 (${tasks.length}):\n${tasks.map(t => `  - ${t}`).join('\n')}`
            : '没有运行中的任务',
          metadata: { tasks },
        };
      }

      const proc = runningProcesses.get(taskId);
      if (!proc) {
        return { success: false, error: `任务不存在或已完成: ${taskId}`, output: '' };
      }

      return {
        success: true,
        output: `任务 "${taskId}" 正在运行 (PID: ${proc.pid ?? 'unknown'})`,
        metadata: { taskId, pid: proc.pid, running: true },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
