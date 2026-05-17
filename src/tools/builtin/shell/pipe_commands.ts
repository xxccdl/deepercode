import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool } from '../../tool-types.js';

const execAsync = promisify(execCb);

export const pipe_commands: Tool = {
  name: 'pipe_commands',
  description: '管道串联多个命令',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      commands: {
        type: 'array',
        items: { type: 'string' },
        description: '命令列表，按顺序通过管道串联',
      },
      cwd: { type: 'string', description: '工作目录' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['commands'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const commands = params.commands as string[];
      const cwd = (params.cwd as string) ?? process.cwd();
      const timeout = (params.timeout_ms as number) ?? 30000;
      const pipeline = commands.join(' | ');

      const { stdout, stderr } = await execAsync(pipeline, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
        shell: process.env.SHELL || process.env.ComSpec || 'cmd.exe',
      });

      return {
        success: true,
        output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''),
        metadata: { pipeline },
      };
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      return {
        success: false,
        error: e.message || String(err),
        output: [e.stdout, e.stderr].filter(Boolean).join('\n'),
      };
    }
  },
};
