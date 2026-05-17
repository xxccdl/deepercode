import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const template_render: Tool = {
  name: 'template_render',
  description: '渲染模板字符串或文件',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      template: { type: 'string', description: '模板字符串，使用 {{key}} 占位' },
      file_path: { type: 'string', description: '模板文件路径' },
      values: { type: 'object', description: '模板变量值' },
      output: { type: 'string', description: '输出文件路径' },
    },
    required: ['values'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const templateStr = params.template as string | undefined;
      const filePath = params.file_path as string | undefined;
      const values = params.values as Record<string, unknown>;
      const output = params.output as string | undefined;

      let template = '';
      if (filePath) {
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `模板文件不存在: ${abs}`, output: '' };
        template = readFileSync(abs, 'utf-8');
      } else if (templateStr) {
        template = templateStr;
      } else {
        return { success: false, error: '请提供 template 或 file_path 参数', output: '' };
      }

      let rendered = template;
      for (const [key, value] of Object.entries(values)) {
        rendered = rendered.replace(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g'), String(value));
      }

      if (output) {
        writeFileSync(output, rendered, 'utf-8');
        return { success: true, output: `模板已渲染并写入: ${output}`, metadata: { keys: Object.keys(values).length } };
      }

      return { success: true, output: rendered, metadata: { keys: Object.keys(values).length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
