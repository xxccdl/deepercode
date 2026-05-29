import { spawn } from 'node:child_process';
import { decodeBuffer } from '../shell/process-pool.js';
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
    return new Promise((resolve) => {
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

      const proc = spawn(cmd, {
        cwd, shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve({ success: false, error: 'npm 命令超时 (120s)', output: '' });
      }, 120_000);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: err.message, output: '' });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        const stdout = decodeBuffer(stdoutChunks);
        const stderr = decodeBuffer(stderrChunks);
        const output = (stdout + (stderr ? `\n[stderr]\n${stderr}` : '')).slice(0, 8000);

        if (code === 0) {
          resolve({ success: true, output: output || `${action} 完成`, metadata: { action, cwd } });
        } else {
          resolve({ success: false, error: `Exit code: ${code}`, output });
        }
      });
    });
  },
};
