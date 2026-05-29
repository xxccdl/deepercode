import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeBuffer } from '../shell/process-pool.js';
import type { Tool } from '../../tool-types.js';

export const docker_manage: Tool = {
  name: 'docker_manage',
  description: 'Docker 容器管理',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: build, run, stop, ps, logs, compose_up, compose_down, pull', enum: ['build', 'run', 'stop', 'ps', 'logs', 'compose_up', 'compose_down', 'pull'] },
      image: { type: 'string', description: '镜像名' },
      container: { type: 'string', description: '容器名' },
      cwd: { type: 'string', description: '工作目录' },
      ports: { type: 'string', description: '端口映射' },
      options: { type: 'string', description: '附加选项' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    return new Promise((res) => {
      const action = params.action as string;
      const image = params.image as string | undefined;
      const container = params.container as string | undefined;
      const cwd = (params.cwd as string) ?? process.cwd();
      const ports = params.ports as string | undefined;
      const options = params.options as string ?? '';

      let cmd = '';

      switch (action) {
        case 'build': {
          const dockerfile = resolve(cwd, 'Dockerfile');
          if (!existsSync(dockerfile)) {
            res({ success: false, error: `Dockerfile 不存在: ${dockerfile}`, output: '' });
            return;
          }
          cmd = `docker build ${options} -t ${image || 'app'} .`;
          break;
        }
        case 'run':
          cmd = `docker run ${ports ? `-p ${ports}` : ''} ${options} ${image || 'app'}`;
          break;
        case 'stop':
          cmd = `docker stop ${container || ''}`;
          break;
        case 'ps':
          cmd = 'docker ps -a';
          break;
        case 'logs':
          cmd = `docker logs ${container || ''}`;
          break;
        case 'compose_up':
          cmd = 'docker-compose up -d';
          break;
        case 'compose_down':
          cmd = 'docker-compose down';
          break;
        case 'pull':
          cmd = `docker pull ${image || ''}`;
          break;
        default:
          res({ success: false, error: `不支持的操作: ${action}`, output: '' });
          return;
      }

      const proc = spawn(cmd, {
        cwd, shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        res({ success: false, error: 'Docker 操作超时 (120s)', output: '' });
      }, 120_000);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        res({ success: false, error: `Docker 操作失败: ${err.message}`, output: '' });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        const stdout = decodeBuffer(stdoutChunks);
        const stderr = decodeBuffer(stderrChunks);
        const rawOutput = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');

        if (code === 0) {
          res({ success: true, output: rawOutput || `${action} 完成`, metadata: { action } });
        } else {
          res({ success: false, error: `Docker 操作失败 (exit code: ${code})`, output: rawOutput });
        }
      });
    });
  },
};
