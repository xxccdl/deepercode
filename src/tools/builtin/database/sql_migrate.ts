import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const sql_migrate: Tool = {
  name: 'sql_migrate',
  description: '执行数据库迁移',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '迁移命令或 SQL 文件路径' },
      connection: { type: 'string', description: '数据库连接字符串' },
      engine: { type: 'string', description: '数据库引擎', enum: ['mysql', 'postgresql', 'sqlite', 'mssql'] },
    },
    required: ['command'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const command = params.command as string;
      const connection = params.connection as string | undefined;
      const engine = (params.engine as string) ?? 'sqlite';

      let cmd = '';
      switch (engine) {
        case 'sqlite':
          cmd = `sqlite3 "${connection || 'database.db'}" < "${command}"`;
          break;
        case 'mysql':
          cmd = `mysql ${connection || ''} < "${command}"`;
          break;
        case 'postgresql':
          cmd = `psql ${connection || ''} -f "${command}"`;
          break;
        default:
          return { success: false, error: `不支持的数据库引擎: ${engine}`, output: '' };
      }

      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
        return { success: true, output: output || '迁移执行成功', metadata: { engine, command } };
      } catch (err: unknown) {
        const e = err as { message?: string; stdout?: string; stderr?: string };
        return {
          success: false,
          error: `迁移失败: ${e.message || String(err)}`,
          output: (e.stdout || '') + (e.stderr || ''),
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
