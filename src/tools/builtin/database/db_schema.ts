import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const db_schema: Tool = {
  name: 'db_schema',
  description: '查看数据库表结构',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      connection: { type: 'string', description: '数据库连接字符串' },
      engine: { type: 'string', description: '数据库引擎: mysql, postgresql, sqlite, mssql', enum: ['mysql', 'postgresql', 'sqlite', 'mssql'] },
      table: { type: 'string', description: '表名（可选）' },
    },
    required: ['engine'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const engine = params.engine as string;
      const table = params.table as string | undefined;
      const connection = params.connection as string | undefined;

      let output = `数据库 Schema 查询\n引擎: ${engine}\n\n`;

      switch (engine) {
        case 'sqlite': {
          if (!connection) {
            return { success: false, error: 'sqlite 需要 connection 参数（文件路径）', output: '' };
          }
          try {
            const result = execSync(`sqlite3 "${connection}" ".schema ${table || ''}"`, {
              encoding: 'utf-8', timeout: 10000, stdio: 'pipe',
            });
            output += result;
          } catch {
            output += 'sqlite3 命令行不可用，请安装 sqlite3 或使用文件路径直接查看数据库。\n';
            output += `文件: ${connection}`;
          }
          break;
        }
        case 'mysql': {
          output += table
            ? `使用: mysql -e "DESCRIBE ${table};" ${connection ? connection : ''}`
            : `使用: mysql -e "SHOW TABLES;" ${connection ? connection : ''}`;
          output += '\n（请确保 mysql 客户端已安装）';
          break;
        }
        case 'postgresql': {
          output += table
            ? `使用: psql ${connection || ''} -c "\\d ${table}"`
            : `使用: psql ${connection || ''} -c "\\dt"`;
          output += '\n（请确保 psql 客户端已安装）';
          break;
        }
        default:
          output += `请使用 ${engine} CLI 或 GUI 工具查看数据库 schema。`;
      }

      return { success: true, output, metadata: { engine, table } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
