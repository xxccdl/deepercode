import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
    try {
      const cwd = (params.cwd as string) ?? process.cwd();
      const target = (params.target as string) ?? 'prod';
      const tool = (params.tool as string) ?? 'auto';

      let cmd = '';
      const pkgPath = resolve(cwd, 'package.json');

      if (tool === 'auto' && existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const scripts = pkg.scripts || {};
        if (scripts.build) cmd = `npm run build`;
        else if (scripts.compile) cmd = `npm run compile`;
        else if (scripts.bundle) cmd = `npm run bundle`;
        else cmd = `npx tsup src/index.ts --format esm`;
      } else {
        switch (tool) {
          case 'tsup': cmd = 'npx tsup src/index.ts --format esm'; break;
          case 'vite': cmd = 'npx vite build'; break;
          case 'webpack': cmd = 'npx webpack --mode production'; break;
          default: cmd = 'npm run build';
        }
      }

      const output = execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 180000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: 'pipe',
      });

      return {
        success: true,
        output: `构建完成\n${output.slice(0, 10000)}`,
        metadata: { cwd, tool, command: cmd },
      };
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      return {
        success: false,
        error: '构建失败: ' + (e.message || String(err)),
        output: (e.stdout || '') + (e.stderr || ''),
      };
    }
  },
};
