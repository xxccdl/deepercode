import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const db_backup: Tool = {
  name: 'db_backup',
  description: '数据库备份',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      engine: { type: 'string', description: '数据库引擎', enum: ['mysql', 'postgresql', 'sqlite'] },
      connection: { type: 'string', description: '连接字符串/数据库名称' },
      output_file: { type: 'string', description: '备份输出文件路径' },
      tables: { type: 'array', items: { type: 'string' }, description: '指定表名列表' },
    },
    required: ['engine', 'output_file'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const engine = params.engine as string;
      const connection = params.connection as string | undefined;
      const outputFile = params.output_file as string;
      const tables = params.tables as string[] | undefined;

      let cmd = '';
      switch (engine) {
        case 'sqlite':
          cmd = `sqlite3 "${connection || 'database.db'}" .dump > "${outputFile}"`;
          break;
        case 'mysql':
          cmd = `mysqldump ${connection || ''} ${(tables || []).join(' ')} > "${outputFile}"`;
          break;
        case 'postgresql':
          cmd = `pg_dump ${connection || ''} > "${outputFile}"`;
          break;
        default:
          return { success: false, error: `不支持的数据库引擎: ${engine}`, output: '' };
      }

      try {
        execSync(cmd, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
        return { success: true, output: `备份完成: ${outputFile}`, metadata: { engine, outputFile } };
      } catch (err: unknown) {
        const e = err as { message?: string };
        return { success: false, error: `备份失败: ${e.message || String(err)}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
