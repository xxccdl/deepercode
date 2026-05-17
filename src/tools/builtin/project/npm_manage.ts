import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const npm_manage: Tool = {
  name: 'npm_manage',
  description: '管理 npm 包（安装、更新、删除、查看）',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: install, update, remove, list, audit, init', enum: ['install', 'update', 'remove', 'list', 'audit', 'init'] },
      package: { type: 'string', description: '包名（install/remove/update 时使用）' },
      cwd: { type: 'string', description: '工作目录' },
      dev: { type: 'boolean', description: '是否安装为 devDependencies' },
      global: { type: 'boolean', description: '是否全局安装' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const action = params.action as string;
      const pkg = params.package as string | undefined;
      const cwd = (params.cwd as string) ?? process.cwd();
      const dev = (params.dev as boolean) ?? false;
      const global = (params.global as boolean) ?? false;

      const registry = 'https://registry.npmmirror.com';
      let cmd = '';

      switch (action) {
        case 'install':
          cmd = `npm install ${pkg || ''} ${dev ? '-D' : ''} ${global ? '-g' : ''} --registry ${registry}`;
          break;
        case 'update':
          cmd = `npm update ${pkg || ''} --registry ${registry}`;
          break;
        case 'remove':
          cmd = `npm uninstall ${pkg || ''}`;
          break;
        case 'list':
          cmd = `npm list --depth=0 ${pkg || ''}`;
          break;
        case 'audit':
          cmd = 'npm audit';
          break;
        case 'init':
          cmd = 'npm init -y';
          break;
      }

      const output = execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: 'pipe',
      });

      return { success: true, output: output || `${action} 完成`, metadata: { action, cwd } };
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
