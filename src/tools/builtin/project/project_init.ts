import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const project_init: Tool = {
  name: 'project_init',
  description: '初始化新项目（npm / 框架模板）',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      template: { type: 'string', description: '模板: npm, vite, next, express, react', enum: ['npm', 'vite', 'next', 'express', 'react'] },
      name: { type: 'string', description: '项目名称' },
      cwd: { type: 'string', description: '创建目录' },
    },
    required: ['template', 'name'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const template = params.template as string;
      const name = params.name as string;
      const cwd = (params.cwd as string) ?? process.cwd();
      const registry = 'https://registry.npmmirror.com';

      const commands: Record<string, string> = {
        npm: `npm init -y --registry ${registry}`,
        vite: `npm create vite@latest ${name} -- --template react-ts`,
        next: `npx create-next-app@latest ${name} --ts --app --no-tailwind --src-dir`,
        express: `npx express-generator ${name}`,
        react: `npx create-react-app ${name}`,
      };

      const cmd = commands[template] || commands.npm;
      const output = execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: 'pipe',
      });

      return {
        success: true,
        output: `项目已创建: ${name} (${template})\n${output.slice(0, 5000)}`,
        metadata: { template, name, cwd },
      };
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      return {
        success: false,
        error: e.message || String(err),
        output: (e.stdout || '') + (e.stderr || ''),
      };
    }
  },
};
