import { spawn } from 'node:child_process';
import { decodeBuffer } from './process-pool.js';
import type { Tool } from '../../tool-types.js';

export const run_command: Tool = {
  name: 'run_command',
  description: '执行系统命令并返回结果 (阻塞等待完成)',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' },
      cwd: { type: 'string', description: '工作目录' },
      timeout_ms: { type: 'number', description: '超时毫秒数 (默认 30s)' },
    },
    required: ['command'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    return new Promise((resolve) => {
      const command = params.command as string;
      const cwd = (params.cwd as string) || process.cwd();
      const timeout = (params.timeout_ms as number) ?? 30_000;

      const proc = spawn(command, {
        cwd, shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve({ success: false, error: `命令超时 (${timeout}ms)`, output: '' });
      }, timeout);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: err.message, output: '' });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        const stdout = decodeBuffer(stdoutChunks);
        const stderr = decodeBuffer(stderrChunks);
        const output = (stdout + (stderr ? `\n[stderr]\n${stderr}` : '')).slice(0, 8000);

        if (code === 0) {
          resolve({ success: true, output, metadata: { command, cwd, exitCode: code } });
        } else {
          resolve({ success: false, error: `Exit code: ${code}`, output });
        }
      });
    });
  },
};
