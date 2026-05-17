import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import type { Tool } from '../../tool-types.js';

const MEMORY_DIR = join(process.env.HOME || process.env.USERPROFILE || process.cwd(), '.deepercode', 'memories');

export const memory_store: Tool = {
  name: 'memory_store',
  description: '持久化记忆存储',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: set, get, list, delete, search', enum: ['set', 'get', 'list', 'delete', 'search'] },
      key: { type: 'string', description: '记忆键名' },
      value: { type: 'string', description: '记忆值' },
      query: { type: 'string', description: '搜索关键词' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const action = params.action as string;
      const key = params.key as string | undefined;
      const value = params.value as string | undefined;
      const query = params.query as string | undefined;

      if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
      }

      switch (action) {
        case 'set': {
          if (!key || value === undefined) return { success: false, error: 'set 需要 key 和 value 参数', output: '' };
          const memPath = join(MEMORY_DIR, `${key}.json`);
          writeFileSync(memPath, JSON.stringify({ key, value, timestamp: Date.now() }), 'utf-8');
          return { success: true, output: `记忆已保存: ${key}` };
        }
        case 'get': {
          if (!key) return { success: false, error: 'get 需要 key 参数', output: '' };
          const memPath = join(MEMORY_DIR, `${key}.json`);
          if (!existsSync(memPath)) return { success: false, error: `记忆不存在: ${key}`, output: '' };
          const data = JSON.parse(readFileSync(memPath, 'utf-8'));
          return { success: true, output: data.value };
        }
        case 'delete': {
          if (!key) return { success: false, error: 'delete 需要 key 参数', output: '' };
          const memPath = join(MEMORY_DIR, `${key}.json`);
          if (!existsSync(memPath)) return { success: false, error: `记忆不存在: ${key}`, output: '' };
          const { unlinkSync } = await import('node:fs');
          unlinkSync(memPath);
          return { success: true, output: `记忆已删除: ${key}` };
        }
        case 'list': {
          const { readdirSync } = await import('node:fs');
          const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
          const keys = files.map(f => f.replace('.json', ''));
          return {
            success: true,
            output: keys.join('\n') || '(暂无记忆)',
            metadata: { count: keys.length },
          };
        }
        case 'search': {
          if (!query) return { success: false, error: 'search 需要 query 参数', output: '' };
          const { readdirSync } = await import('node:fs');
          const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
          const matches: string[] = [];
          for (const f of files) {
            const data = JSON.parse(readFileSync(join(MEMORY_DIR, f), 'utf-8'));
            if (data.value.includes(query) || data.key.includes(query)) {
              matches.push(`${data.key}: ${data.value.slice(0, 200)}`);
            }
          }
          return { success: true, output: matches.join('\n') || '未找到匹配记忆', metadata: { count: matches.length } };
        }
        default:
          return { success: false, error: `不支持的操作: ${action}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
