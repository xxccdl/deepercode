import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const coverage_report: Tool = {
  name: 'coverage_report',
  description: '生成代码覆盖报告',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      cwd: { type: 'string', description: '项目目录' },
      runner: { type: 'string', description: '测试运行器', enum: ['vitest', 'jest', 'nyc'] },
      format: { type: 'string', description: '报告格式: text, html, json, lcov', enum: ['text', 'html', 'json', 'lcov'] },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const cwd = (params.cwd as string) ?? process.cwd();
      const runner = (params.runner as string) ?? 'vitest';
      const format = (params.format as string) ?? 'text';

      let cmd = '';
      switch (runner) {
        case 'vitest': cmd = `npx vitest run --coverage --reporter=${format}`; break;
        case 'jest': cmd = `npx jest --coverage`; break;
        case 'nyc': cmd = `npx nyc --reporter=${format} npm test`; break;
      }

      try {
        const output = execSync(cmd, {
          cwd,
          encoding: 'utf-8',
          timeout: 180000,
          maxBuffer: 50 * 1024 * 1024,
          stdio: 'pipe',
        });
        return {
          success: true,
          output: `覆盖报告:\n${output.slice(0, 10000)}`,
          metadata: { runner, format, cwd },
        };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        return {
          success: false,
          error: '覆盖报告生成失败',
          output: (e.stdout || '') + (e.stderr || ''),
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
