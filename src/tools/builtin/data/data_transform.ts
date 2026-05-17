import type { Tool } from '../../tool-types.js';

export const data_transform: Tool = {
  name: 'data_transform',
  description: '数据格式转换（JSON/CSV/YAML/XML 互转）',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: '输入数据' },
      from: { type: 'string', description: '源格式: json, csv, yaml, xml', enum: ['json', 'csv', 'yaml', 'xml'] },
      to: { type: 'string', description: '目标格式: json, csv, yaml, xml', enum: ['json', 'csv', 'yaml', 'xml'] },
      file_path: { type: 'string', description: '文件路径' },
      output: { type: 'string', description: '输出文件路径' },
    },
    required: ['from', 'to'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const from = params.from as string;
      const to = params.to as string;
      const data = params.data as string | undefined;
      const filePath = params.file_path as string | undefined;
      const output = params.output as string | undefined;

      let inputStr = '';
      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        inputStr = readFileSync(abs, 'utf-8');
      } else if (data) {
        inputStr = data;
      } else {
        return { success: false, error: '请提供 data 或 file_path 参数', output: '' };
      }

      let parsed: unknown;
      switch (from) {
        case 'json': parsed = JSON.parse(inputStr); break;
        case 'yaml': { const yaml = await import('yaml'); parsed = yaml.parse(inputStr); break; }
        case 'csv': {
          const { parse } = await import('csv-parse/sync');
          parsed = parse(inputStr, { columns: true, skip_empty_lines: true });
          break;
        }
        case 'xml': parsed = inputStr; break;
        default: return { success: false, error: `不支持的源格式: ${from}`, output: '' };
      }

      let outputStr = '';
      switch (to) {
        case 'json': outputStr = JSON.stringify(parsed, null, 2); break;
        case 'yaml': { const yaml = await import('yaml'); outputStr = yaml.stringify(parsed); break; }
        case 'xml': outputStr = typeof parsed === 'string' ? parsed : `<root>${JSON.stringify(parsed)}</root>`; break;
        case 'csv': outputStr = JSON.stringify(parsed); break;
        default: return { success: false, error: `不支持的目标格式: ${to}`, output: '' };
      }

      if (output) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(output, outputStr, 'utf-8');
        return { success: true, output: `转换完成并写入: ${output}`, metadata: { from, to } };
      }

      return { success: true, output: outputStr, metadata: { from, to } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
