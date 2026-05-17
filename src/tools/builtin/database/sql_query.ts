import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const sql_query: Tool = {
  name: 'sql_query',
  description: '执行 SQL 查询',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL 查询语句' },
      connection: { type: 'string', description: '数据库连接字符串' },
      engine: { type: 'string', description: '数据库引擎: mysql, postgresql, sqlite, mssql', enum: ['mysql', 'postgresql', 'sqlite', 'mssql'] },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
    },
    required: ['query', 'engine'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const query = params.query as string;
      const engine = params.engine as string;
      const connection = params.connection as string | undefined;
      const timeout = (params.timeout_ms as number) ?? 30000;

      let cmd = '';
      switch (engine) {
        case 'sqlite':
          cmd = `sqlite3 "${connection || 'database.db'}" "${query.replace(/"/g, '\\"')}"`;
          break;
        case 'mysql':
          cmd = `mysql ${connection || ''} -e "${query.replace(/"/g, '\\"')}"`;
          break;
        case 'postgresql':
          cmd = `psql ${connection || ''} -c "${query.replace(/"/g, '\\"')}"`;
          break;
        case 'mssql':
          cmd = `sqlcmd ${connection ? connection : ''} -Q "${query.replace(/"/g, '\\"')}"`;
          break;
        default:
          return { success: false, error: `不支持的数据库引擎: ${engine}`, output: '' };
      }

      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout, maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' });
        return { success: true, output, metadata: { engine } };
      } catch (err: unknown) {
        const e = err as { message?: string; stdout?: string; stderr?: string };
        return {
          success: false,
          error: `查询失败: ${e.message || String(err)}`,
          output: (e.stdout || '') + (e.stderr || ''),
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
