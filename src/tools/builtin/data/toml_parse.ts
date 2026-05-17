import type { Tool } from '../../tool-types.js';

export const toml_parse: Tool = {
  name: 'toml_parse',
  description: '解析 TOML 内容',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'TOML 字符串内容' },
      file_path: { type: 'string', description: 'TOML 文件路径' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const content = params.content as string | undefined;
      const filePath = params.file_path as string | undefined;

      let tomlContent = '';
      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        tomlContent = readFileSync(abs, 'utf-8');
      } else if (content) {
        tomlContent = content;
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      const { parse } = await import('toml');
      const parsed = parse(tomlContent);
      return { success: true, output: JSON.stringify(parsed, null, 2) };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
