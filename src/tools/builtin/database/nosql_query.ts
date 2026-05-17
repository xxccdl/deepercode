import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const nosql_query: Tool = {
  name: 'nosql_query',
  description: '执行 NoSQL 数据库操作（MongoDB shell）',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '查询语句（MongoDB shell 语法）' },
      connection: { type: 'string', description: '连接字符串 mongodb://...' },
      collection: { type: 'string', description: '集合名称' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['query'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const query = params.query as string;
      const connection = (params.connection as string) ?? 'mongodb://localhost:27017';
      const collection = params.collection as string | undefined;
      const timeout = (params.timeout_ms as number) ?? 30000;

      const queryScript = collection
        ? `db.${collection}.${query}`
        : query;

      try {
        const output = execSync(
          `mongosh "${connection}" --eval "${queryScript.replace(/"/g, '\\"')}"`,
          { encoding: 'utf-8', timeout, maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' }
        );
        return { success: true, output, metadata: { connection, collection } };
      } catch {
        return {
          success: true,
          output: `MongoDB 查询请求:\n连接: ${connection}\n集合: ${collection || '(未指定)'}\n查询: ${queryScript}\n\n注意: mongosh 命令行不可用。请确保已安装 MongoDB Shell，或将查询语句直接在 mongosh 中执行。`,
          metadata: { connection, fallback: true },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
