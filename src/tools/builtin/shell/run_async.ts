import { spawn } from 'node:child_process';
import { decodeBuffer } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

const runningProcesses = new Map<string, ReturnType<typeof spawn>>();

export const run_async: Tool = {
  name: 'run_async',
  description: '异步执行命令并等待完成 (可配合 check_status / stop_command)',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '命令和参数' },
      cwd: { type: 'string', description: '工作目录' },
      task_id: { type: 'string', description: '任务标识，用于后续查询' },
    },
    required: ['command'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const command = params.command as string;
      const cwd = (params.cwd as string) ?? process.cwd();
      const taskId = (params.task_id as string) ?? `async_${Date.now()}`;

      const [cmd, ...args] = command.split(/\s+/);
      const proc = spawn(cmd, args, {
        cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      runningProcesses.set(taskId, proc);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (d: Buffer) => stdoutChunks.push(d));
      proc.stderr?.on('data', (d: Buffer) => stderrChunks.push(d));

      try {
        await new Promise<void>((resolve, reject) => {
          proc.on('close', (code) => {
            runningProcesses.delete(taskId);
            if (code === 0) resolve();
            else reject(new Error(`进程退出码: ${code}`));
          });
          proc.on('error', reject);
        });
      } catch (e) {
        runningProcesses.delete(taskId);
        return {
          success: false,
          error: (e as Error).message,
          output: decodeBuffer(stdoutChunks) + decodeBuffer(stderrChunks),
          metadata: { taskId },
        };
      }

      return {
        success: true,
        output: decodeBuffer(stdoutChunks) + (stderrChunks.length ? '\n[stderr]\n' + decodeBuffer(stderrChunks) : '') || '(无输出)',
        metadata: { taskId, command },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

export { runningProcesses };
