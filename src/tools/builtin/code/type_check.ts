import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const type_check: Tool = {
  name: 'type_check',
  description: '运行 TypeScript 类型检查',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'tsconfig.json 路径' },
      strict: { type: 'boolean', description: '是否严格模式' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const project = params.project as string | undefined;
      const strict = (params.strict as boolean) ?? true;

      try {
        const args = ['tsc', '--noEmit'];
        if (project) args.push('--project', resolve(project));
        if (strict) args.push('--strict');

        const output = execSync(args.join(' '), {
          encoding: 'utf-8',
          timeout: 120000,
          stdio: 'pipe',
        });
        return { success: true, output: output || '类型检查通过！', metadata: { passed: true } };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        return {
          success: false,
          error: '类型检查发现错误',
          output: e.stdout || e.stderr || String(err),
          metadata: { passed: false },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
