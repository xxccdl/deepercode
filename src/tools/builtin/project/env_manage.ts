import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const env_manage: Tool = {
  name: 'env_manage',
  description: '管理环境变量文件',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: read, set, remove, list_envs', enum: ['read', 'set', 'remove', 'list_envs'] },
      file_path: { type: 'string', description: '.env 文件路径' },
      key: { type: 'string', description: '环境变量名' },
      value: { type: 'string', description: '环境变量值' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const action = params.action as string;
      const filePath = (params.file_path as string) ?? '.env';
      const key = params.key as string | undefined;
      const value = params.value as string | undefined;

      const abs = resolve(filePath);

      if (action === 'list_envs') {
        const cwd = process.cwd();
        const envs = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
        const found = envs.filter(f => existsSync(resolve(cwd, f)));
        return {
          success: true,
          output: found.join('\n') || '未找到 .env 文件',
          metadata: { files: found },
        };
      }

      if (!existsSync(abs)) {
        if (action === 'set' && key && value !== undefined) {
          writeFileSync(abs, `${key}=${value}`, 'utf-8');
          return { success: true, output: `已创建 ${filePath} 并设置 ${key}=${value}` };
        }
        return { success: false, error: `文件不存在: ${abs}`, output: '' };
      }

      const content = readFileSync(abs, 'utf-8');
      const lines = content.split('\n');

      if (action === 'read') {
        if (key) {
          const found = lines.find(l => l.startsWith(`${key}=`));
          return {
            success: true,
            output: found ? found.slice(key.length + 1) : `未找到 ${key}`,
          };
        }
        return { success: true, output: content };
      }

      if (action === 'set' && key && value !== undefined) {
        let found = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith(`${key}=`) || lines[i].startsWith(`# ${key}=`)) {
            lines[i] = `${key}=${value}`;
            found = true;
            break;
          }
        }
        if (!found) lines.push(`${key}=${value}`);
        writeFileSync(abs, lines.join('\n'), 'utf-8');
        return { success: true, output: `已设置 ${key}=${value}` };
      }

      if (action === 'remove' && key) {
        const filtered = lines.filter(l => !l.startsWith(`${key}=`));
        writeFileSync(abs, filtered.join('\n'), 'utf-8');
        return { success: true, output: `已移除 ${key}` };
      }

      return { success: false, error: `不支持的操作: ${action}`, output: '' };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
