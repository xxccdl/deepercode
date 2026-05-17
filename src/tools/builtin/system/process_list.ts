import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const process_list: Tool = {
  name: 'process_list',
  description: '列出当前运行的进程',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {
      filter: { type: 'string', description: '进程名过滤' },
      count: { type: 'number', description: '显示数量' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filter = params.filter as string | undefined;
      const count = (params.count as number) ?? 20;
      const platform = process.platform;

      let cmd: string;
      if (platform === 'win32') {
        cmd = 'tasklist /FO CSV /NH';
      } else {
        cmd = 'ps aux --sort=-%mem';
      }

      try {
        let output = execSync(cmd, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
        const lines = output.split('\n');

        if (filter) {
          const filtered = lines.filter(l => l.toLowerCase().includes(filter.toLowerCase()));
          output = filtered.slice(0, count).join('\n');
        } else {
          output = lines.slice(0, count).join('\n');
        }

        return {
          success: true,
          output: `进程列表 (${platform}):\n${output}`,
          metadata: { platform, filter, lines: Math.min(lines.length, count) },
        };
      } catch {
        const os = await import('node:os');
        return {
          success: true,
          output: [
            `当前进程信息:`,
            `PID: ${process.pid}`,
            `平台: ${os.platform()}`,
            `架构: ${os.arch()}`,
            `Node.js: ${process.version}`,
            `CPU 数: ${os.cpus().length}`,
          ].join('\n'),
          metadata: { pid: process.pid },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
