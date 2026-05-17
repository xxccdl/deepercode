import type { Tool } from '../../tool-types.js';

export const resource_monitor: Tool = {
  name: 'resource_monitor',
  description: '监控系统资源使用情况',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {
      interval_ms: { type: 'number', description: '采样间隔毫秒' },
      samples: { type: 'number', description: '采样次数' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const intervalMs = (params.interval_ms as number) ?? 1000;
      const samples = (params.samples as number) ?? 3;

      const os = await import('node:os');
      const results: Record<string, unknown>[] = [];

      for (let i = 0; i < samples; i++) {
        const cpus = os.cpus();
        const totalIdle = cpus.reduce((s, c) => s + c.times.idle, 0);
        const totalTick = cpus.reduce((s, c) => s + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0);
        const cpuUsage = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100).toFixed(1) : '0';

        results.push({
          sample: i + 1,
          cpu: `${cpuUsage}%`,
          memory: {
            total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
            free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
            used: `${((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1)}%`,
          },
          uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
          loadAverage: os.loadavg().map(l => l.toFixed(2)),
        });

        if (i < samples - 1) {
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }

      const latest = results[results.length - 1];
      const output = [
        `资源监控 (${samples} 采样，间隔 ${intervalMs}ms):`,
        `CPU 使用率: ${(latest as Record<string, unknown>).cpu}`,
        `内存: ${JSON.stringify((latest as Record<string, unknown>).memory)}`,
        `运行时间: ${(latest as Record<string, unknown>).uptime}`,
        `平均负载: ${JSON.stringify((latest as Record<string, unknown>).loadAverage)}`,
      ].join('\n');

      return {
        success: true,
        output,
        metadata: { samples, intervalMs, latest },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
