import type { Tool } from '../../tool-types.js';

export const csv_parse: Tool = {
  name: 'csv_parse',
  description: '解析 CSV 内容',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'CSV 字符串' },
      file_path: { type: 'string', description: 'CSV 文件路径' },
      delimiter: { type: 'string', description: '列分隔符，默认逗号' },
      has_header: { type: 'boolean', description: '是否有标题行' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      let csvContent = '';
      const filePath = params.file_path as string | undefined;
      const content = params.content as string | undefined;
      const delimiter = (params.delimiter as string) ?? ',';
      const hasHeader = (params.has_header as boolean) ?? true;

      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        csvContent = readFileSync(abs, 'utf-8');
      } else if (content) {
        csvContent = content;
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      const { parse } = await import('csv-parse/sync');
      const records = parse(csvContent, {
        delimiter,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
      });

      return {
        success: true,
        output: JSON.stringify(records, null, 2),
        metadata: { rows: Array.isArray(records) ? records.length : 0 },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
