import type { Tool } from '../../tool-types.js';

export const json_parse: Tool = {
  name: 'json_parse',
  description: '解析和格式化 JSON 内容',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'JSON 字符串' },
      file_path: { type: 'string', description: 'JSON 文件路径' },
      pretty: { type: 'boolean', description: '是否美化输出' },
      query: { type: 'string', description: 'JSONPath 查询' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const content = params.content as string | undefined;
      const filePath = params.file_path as string | undefined;
      const pretty = (params.pretty as boolean) ?? true;
      const query = params.query as string | undefined;

      let jsonContent = '';
      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        jsonContent = readFileSync(abs, 'utf-8');
      } else if (content) {
        jsonContent = content;
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      const parsed = JSON.parse(jsonContent);

      if (query) {
        const value = resolveJsonPath(parsed, query);
        return {
          success: true,
          output: JSON.stringify(value, null, pretty ? 2 : 0),
          metadata: { query },
        };
      }

      return { success: true, output: JSON.stringify(parsed, null, pretty ? 2 : 0) };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function resolveJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (bracketMatch) {
      current = (current as Record<string, unknown>)[bracketMatch[1]];
      current = (current as unknown[])?.[parseInt(bracketMatch[2])];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
