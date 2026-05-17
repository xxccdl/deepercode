import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const redis_command: Tool = {
  name: 'redis_command',
  description: '执行 Redis 命令',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'Redis 主机' },
      port: { type: 'number', description: 'Redis 端口' },
      password: { type: 'string', description: '认证密码' },
      command: { type: 'string', description: 'Redis 命令' },
    },
    required: ['command'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const host = (params.host as string) ?? 'localhost';
      const port = (params.port as number) ?? 6379;
      const password = params.password as string | undefined;
      const command = params.command as string;

      let cmd = `redis-cli -h ${host} -p ${port}`;
      if (password) cmd += ` -a "${password}"`;
      cmd += ` ${command}`;

      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
        return { success: true, output, metadata: { host, port } };
      } catch (err: unknown) {
        const e = err as { message?: string; stdout?: string; stderr?: string };
        return {
          success: false,
          error: `Redis 命令失败: ${e.message || String(err)}`,
          output: (e.stdout || '') + (e.stderr || ''),
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
