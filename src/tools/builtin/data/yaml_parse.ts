import type { Tool } from '../../tool-types.js';

export const yaml_parse: Tool = {
  name: 'yaml_parse',
  description: '解析 YAML 内容',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'YAML 字符串' },
      file_path: { type: 'string', description: 'YAML 文件路径' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      let yamlContent = '';
      const filePath = params.file_path as string | undefined;
      const content = params.content as string | undefined;

      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        yamlContent = readFileSync(abs, 'utf-8');
      } else if (content) {
        yamlContent = content;
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      const { parse } = await import('yaml');
      const parsed = parse(yamlContent);
      return { success: true, output: JSON.stringify(parsed, null, 2) };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
