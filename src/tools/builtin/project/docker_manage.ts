import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
    try {
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
            return { success: false, error: `Dockerfile 不存在: ${dockerfile}`, output: '' };
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
          return { success: false, error: `不支持的操作: ${action}`, output: '' };
      }

      try {
        const output = execSync(cmd, {
          cwd,
          encoding: 'utf-8',
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
          stdio: 'pipe',
        });
        return { success: true, output: output || `${action} 完成`, metadata: { action } };
      } catch (err: unknown) {
        const e = err as { message?: string; stdout?: string; stderr?: string };
        return {
          success: false,
          error: `Docker 操作失败: ${e.message || String(err)}`,
          output: (e.stdout || '') + (e.stderr || ''),
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
