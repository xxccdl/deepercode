import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { decodeBuffer } from '../shell/process-pool.js';
import type { Tool } from '../../tool-types.js';

export const build_project: Tool = {
  name: 'build_project',
  description: '构建项目',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      cwd: { type: 'string', description: '项目目录' },
      target: { type: 'string', description: '构建目标: dev, prod, dist', enum: ['dev', 'prod', 'dist'] },
      tool: { type: 'string', description: '构建工具: auto, tsup, vite, webpack', enum: ['auto', 'tsup', 'vite', 'webpack'] },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    return new Promise((resolve) => {
      const cwd = (params.cwd as string) ?? process.cwd();
      const target = (params.target as string) ?? 'prod';
      const tool = (params.tool as string) ?? 'auto';

      let cmd = '';
      const pkgPath = pathResolve(cwd, 'package.json');

      if (tool === 'auto' && existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const scripts = pkg.scripts || {};
        if (scripts.build) cmd = 'npm run build';
        else if (scripts.compile) cmd = 'npm run compile';
        else if (scripts.bundle) cmd = 'npm run bundle';
        else cmd = 'npx tsup src/index.ts --format esm';
      } else {
        switch (tool) {
          case 'tsup': cmd = 'npx tsup src/index.ts --format esm'; break;
          case 'vite': cmd = 'npx vite build'; break;
          case 'webpack': cmd = 'npx webpack --mode production'; break;
          default: cmd = 'npm run build';
        }
      }

      const proc = spawn(cmd, {
        cwd, shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve({ success: false, error: '构建超时 (180s)', output: '' });
      }, 180_000);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: '构建失败: ' + err.message, output: '' });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        const stdout = decodeBuffer(stdoutChunks);
        const stderr = decodeBuffer(stderrChunks);
        const rawOutput = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');

        if (code === 0) {
          resolve({
            success: true,
            output: `构建完成\n${rawOutput.slice(0, 10000)}`,
            metadata: { cwd, tool, command: cmd },
          });
        } else {
          resolve({
            success: false,
            error: `构建失败 (exit code: ${code})`,
            output: rawOutput.slice(0, 8000),
          });
        }
      });
    });
  },
};
