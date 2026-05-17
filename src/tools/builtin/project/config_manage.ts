import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const config_manage: Tool = {
  name: 'config_manage',
  description: '管理项目配置文件',
  category: 'project',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: read, set, list, init', enum: ['read', 'set', 'list', 'init'] },
      file_path: { type: 'string', description: '配置文件路径 (.json, .yaml, .env, .toml)' },
      key: { type: 'string', description: '配置键名' },
      value: { type: 'string', description: '配置值' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const action = params.action as string;
      const filePath = params.file_path as string | undefined;
      const key = params.key as string | undefined;
      const value = params.value as string | undefined;

      if (action === 'list') {
        const configs = [
          '.env', '.env.local', '.env.development', '.env.production',
          'package.json', 'tsconfig.json', '.eslintrc.json', '.prettierrc',
        ];
        const cwd = process.cwd();
        const found = configs.filter(f => existsSync(resolve(cwd, f)));
        return {
          success: true,
          output: `项目配置文件:\n${found.map(f => `  ${f}`).join('\n') || '  (未找到)'}`,
          metadata: { files: found },
        };
      }

      if (action === 'init') {
        const defaultEnv = `# DeeperCode 配置文件\nNODE_ENV=development\n`;
        writeFileSync(resolve(process.cwd(), '.env'), defaultEnv, 'utf-8');
        return { success: true, output: '已创建 .env 配置文件' };
      }

      if (!filePath) {
        return { success: false, error: '缺少 file_path 参数', output: '' };
      }

      const abs = resolve(filePath);
      if (!existsSync(abs)) {
        return { success: false, error: `配置文件不存在: ${abs}`, output: '' };
      }

      if (action === 'read') {
        const content = readFileSync(abs, 'utf-8');
        if (filePath.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (key) {
            return {
              success: true,
              output: `${key}: ${JSON.stringify((parsed as Record<string, unknown>)[key])}`,
            };
          }
          return { success: true, output: JSON.stringify(parsed, null, 2) };
        }
        return { success: true, output: content.slice(0, 10000) };
      }

      if (action === 'set' && key && value !== undefined) {
        if (filePath.endsWith('.json')) {
          const parsed = JSON.parse(readFileSync(abs, 'utf-8'));
          try { parsed[key] = JSON.parse(value); } catch { parsed[key] = value; }
          writeFileSync(abs, JSON.stringify(parsed, null, 2), 'utf-8');
        } else {
          const content = readFileSync(abs, 'utf-8');
          const lines = content.split('\n');
          let found = false;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`${key}=`)) {
              lines[i] = `${key}=${value}`;
              found = true;
              break;
            }
          }
          if (!found) lines.push(`${key}=${value}`);
          writeFileSync(abs, lines.join('\n'), 'utf-8');
        }
        return { success: true, output: `已设置: ${key} = ${value}` };
      }

      return { success: false, error: `不支持的操作组合: ${action}`, output: '' };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
