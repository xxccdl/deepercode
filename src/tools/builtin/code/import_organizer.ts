import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const import_organizer: Tool = {
  name: 'import_organizer',
  description: '整理和组织导入语句',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件路径' },
      group_by: { type: 'string', description: '分组方式: none, type, source', enum: ['none', 'type', 'source'] },
      sort: { type: 'boolean', description: '是否排序' },
      remove_unused: { type: 'boolean', description: '是否移除未使用导入' },
    },
    required: ['file_path'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const groupBy = (params.group_by as string) ?? 'source';
      const sort = (params.sort as boolean) ?? true;
      const removeUnused = (params.remove_unused as boolean) ?? false;

      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const importLines: { index: number; line: string; isRelative: boolean }[] = [];
      const otherLines: { index: number; line: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^(import\s+|require\(|from\s+|import\(|import\s*\{)/.test(trimmed)) {
          importLines.push({
            index: i,
            line: trimmed,
            isRelative: trimmed.includes("'./") || trimmed.includes("'../") || trimmed.includes('"./') || trimmed.includes('"../'),
          });
        } else {
          otherLines.push({ index: i, line: trimmed });
        }
      }

      let organized: string[];
      if (groupBy === 'source') {
        const external = importLines.filter(i => !i.isRelative).map(i => i.line).sort();
        const internal = importLines.filter(i => i.isRelative).map(i => i.line).sort();
        organized = [...external, ...(external.length && internal.length ? [''] : []), ...internal];
      } else if (groupBy === 'type') {
        const typeImports = importLines.filter(i => i.line.includes('import type')).map(i => i.line).sort();
        const valueImports = importLines.filter(i => !i.line.includes('import type')).map(i => i.line).sort();
        organized = [...typeImports, ...(typeImports.length && valueImports.length ? [''] : []), ...valueImports];
      } else {
        organized = sort ? importLines.map(i => i.line).sort() : importLines.map(i => i.line);
      }

      const updated = [...organized, '', ...otherLines.map(l => l.line)].join('\n');

      if (removeUnused) {
        return {
          success: true,
          output: `导入已整理: ${filePath}\n\n建议: 使用 'npx eslint --fix' 或 'organize-imports-cli' 自动移除未使用导入。\n\n整理后:\n${updated.slice(0, 10000)}`,
          metadata: { filePath, importCount: organized.length, removeUnused },
        };
      }

      return {
        success: true,
        output: `导入已整理: ${filePath}\n整理后:\n${updated.slice(0, 10000)}`,
        metadata: { filePath, importCount: organized.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
