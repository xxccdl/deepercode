import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeBuffer } from '../shell/process-pool.js';
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
    return new Promise((resolve) => {
      const cwd = (params.cwd as string) ?? process.cwd();
      const runner = (params.runner as string) ?? 'vitest';
      const format = (params.format as string) ?? 'text';

      let cmd = '';
      switch (runner) {
        case 'vitest': cmd = `npx vitest run --coverage --reporter=${format}`; break;
        case 'jest': cmd = `npx jest --coverage`; break;
        case 'nyc': cmd = `npx nyc --reporter=${format} npm test`; break;
      }

      const proc = spawn(cmd, {
        cwd, shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve({ success: false, error: '覆盖报告生成超时 (180s)', output: '' });
      }, 180_000);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: '覆盖报告生成失败: ' + err.message, output: '' });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        const stdout = decodeBuffer(stdoutChunks);
        const stderr = decodeBuffer(stderrChunks);
        const rawOutput = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');

        if (code === 0) {
          resolve({
            success: true,
            output: `覆盖报告:\n${rawOutput.slice(0, 10000)}`,
            metadata: { runner, format, cwd },
          });
        } else {
          resolve({
            success: false,
            error: `覆盖报告生成失败 (exit code: ${code})`,
            output: rawOutput.slice(0, 8000),
          });
        }
      });
    });
  },
};
