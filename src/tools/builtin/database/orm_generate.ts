import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const orm_generate: Tool = {
  name: 'orm_generate',
  description: '生成 ORM 模型代码（基于数据库 schema）',
  category: 'database',
  parameters: {
    type: 'object',
    properties: {
      engine: { type: 'string', description: '数据库引擎', enum: ['mysql', 'postgresql', 'sqlite', 'mssql'] },
      connection: { type: 'string', description: '连接字符串' },
      output_dir: { type: 'string', description: '输出目录' },
      orm: { type: 'string', description: 'ORM 框架: prisma, typeorm, drizzle, sequelize', enum: ['prisma', 'typeorm', 'drizzle', 'sequelize'] },
    },
    required: ['engine', 'orm'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const engine = params.engine as string;
      const connection = params.connection as string | undefined;
      const outputDir = (params.output_dir as string) ?? './models';
      const orm = params.orm as string;

      const tips: Record<string, string[]> = {
        prisma: [
          `npx prisma init --datasource-provider ${engine}`,
          '将上述 schema 写入 prisma/schema.prisma',
          'npx prisma db pull  # 从数据库拉取 schema',
          'npx prisma generate   # 生成 Prisma Client',
        ],
        typeorm: [
          'npx typeorm-model-generator -h host -d database -p port -u user -x password -e engine -o outputDir',
          '或使用: npx typeorm entity:create',
        ],
        drizzle: [
          'npx drizzle-kit introspect:pg  # PostgreSQL',
          'npx drizzle-kit introspect:mysql  # MySQL',
          'npx drizzle-kit generate',
        ],
        sequelize: [
          'npx sequelize-auto -h host -d database -u user -x password -p port --dialect engine -o outputDir',
        ],
      };

      const output = [
        `ORM 模型生成方案`,
        `数据库引擎: ${engine}`,
        `ORM 框架: ${orm}`,
        `输出目录: ${outputDir}`,
        '',
        '操作步骤:',
        ...(tips[orm] || []).map(t => `  ${t}`),
        '',
        '提示: 生成模型代码后，请根据项目需要手动调整字段类型和关联关系。',
      ].join('\n');

      return { success: true, output, metadata: { engine, orm, outputDir } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
