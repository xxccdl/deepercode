import { execSync } from 'node:child_process';
import type { Tool } from '../../tool-types.js';

export const db_restore: Tool = {
  name: 'db_restore',
  description: '数据库恢复',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      engine: { type: 'string', description: '数据库引擎', enum: ['mysql', 'postgresql', 'sqlite'] },
      connection: { type: 'string', description: '连接字符串' },
      backup_file: { type: 'string', description: '备份文件路径' },
    },
    required: ['engine', 'backup_file'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const engine = params.engine as string;
      const connection = params.connection as string | undefined;
      const backupFile = params.backup_file as string;

      let cmd = '';
      switch (engine) {
        case 'sqlite':
          cmd = `sqlite3 "${connection || 'database.db'}" < "${backupFile}"`;
          break;
        case 'mysql':
          cmd = `mysql ${connection || ''} < "${backupFile}"`;
          break;
        case 'postgresql':
          cmd = `psql ${connection || ''} < "${backupFile}"`;
          break;
        default:
          return { success: false, error: `不支持的数据库引擎: ${engine}`, output: '' };
      }

      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
        return { success: true, output: `恢复完成: ${backupFile}\n${output || ''}`, metadata: { engine, backupFile } };
      } catch (err: unknown) {
        const e = err as { message?: string };
        return { success: false, error: `恢复失败: ${e.message || String(err)}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
