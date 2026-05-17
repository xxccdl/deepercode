import { readFileSync, existsSync } from 'node:fs';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

const execAsync = promisify(execCb);

export const shell_script: Tool = {
  name: 'shell_script',
  description: '执行 Shell 脚本文件',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      script_path: { type: 'string', description: '脚本文件路径' },
      args: { type: 'array', items: { type: 'string' }, description: '脚本参数' },
      cwd: { type: 'string', description: '工作目录' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['script_path'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const scriptPath = resolve(params.script_path as string);
      const args = (params.args as string[]) ?? [];
      const cwd = (params.cwd as string) ?? process.cwd();
      const timeout = (params.timeout_ms as number) ?? 30000;

      if (!existsSync(scriptPath)) {
        return { success: false, error: `脚本文件不存在: ${scriptPath}`, output: '' };
      }

      const shell = process.platform === 'win32'
        ? process.env.ComSpec || 'cmd.exe'
        : process.env.SHELL || '/bin/sh';

      const cmd = process.platform === 'win32'
        ? `"${shell}" /c "${scriptPath}" ${args.join(' ')}`
        : `${shell} "${scriptPath}" ${args.join(' ')}`;

      const { stdout, stderr } = await execAsync(cmd, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''),
        metadata: { script: scriptPath },
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
