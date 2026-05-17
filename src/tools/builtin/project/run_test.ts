import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const run_test: Tool = {
  name: 'run_test',
  description: '运行项目测试',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      cwd: { type: 'string', description: '项目目录' },
      test_file: { type: 'string', description: '指定测试文件' },
      runner: { type: 'string', description: '测试运行器: auto, vitest, jest, mocha', enum: ['auto', 'vitest', 'jest', 'mocha'] },
      coverage: { type: 'boolean', description: '是否生成覆盖报告' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const cwd = (params.cwd as string) ?? process.cwd();
      const testFile = params.test_file as string | undefined;
      const runner = (params.runner as string) ?? 'auto';
      const coverage = (params.coverage as boolean) ?? false;

      let cmd = '';
      if (runner === 'auto') {
        const pkgPath = resolve(cwd, 'package.json');
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          const scripts = pkg.scripts || {};
          if (scripts.test) cmd = `npm run test`;
          else if (scripts['test:watch']) cmd = `npm run test:watch`;
          else cmd = 'npx vitest run';
        } else {
          cmd = 'npx vitest run';
        }
      } else {
        switch (runner) {
          case 'vitest': cmd = 'npx vitest run'; break;
          case 'jest': cmd = 'npx jest'; break;
          case 'mocha': cmd = 'npx mocha'; break;
        }
      }

      if (testFile) cmd += ` "${testFile}"`;
      if (coverage) cmd += ' --coverage';

      const output = execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 180000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: 'pipe',
      });

      return {
        success: true,
        output: `测试完成\n${output.slice(0, 10000)}`,
        metadata: { cwd, coverage },
      };
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      return {
        success: false,
        error: '测试失败',
        output: (e.stdout || '') + (e.stderr || ''),
      };
    }
  },
};
