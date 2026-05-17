import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const lint_code: Tool = {
  name: 'lint_code',
  description: '运行代码检查（ESLint）',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件或目录路径' },
      fix: { type: 'boolean', description: '是否自动修复' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = params.file_path as string | undefined;
      const fix = (params.fix as boolean) ?? false;

      const target = filePath ? resolve(filePath) : '.';

      try {
        const cmd = fix ? `npx eslint "${target}" --fix` : `npx eslint "${target}"`;
        const output = execSync(cmd, {
          encoding: 'utf-8',
          timeout: 60000,
          stdio: 'pipe',
        });
        return { success: true, output: output || '代码检查通过，无问题！', metadata: { target, fix } };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        const issues = e.stdout || e.stderr || String(err);
        return {
          success: false,
          error: '代码检查发现问题',
          output: issues,
          metadata: { target, hasIssues: true },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
