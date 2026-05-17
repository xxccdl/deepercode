import type { Tool } from '../../tool-types.js';

export const system_info: Tool = {
  name: 'system_info',
  description: '获取系统信息',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute() {
    try {
      const os = await import('node:os');

      const info = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
        nodeVersion: process.version,
        homeDir: os.homedir(),
        tmpDir: os.tmpdir(),
        cwd: process.cwd(),
      };

      const output = Object.entries(info)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      return { success: true, output, metadata: info };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
