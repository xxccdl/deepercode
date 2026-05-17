import type { Tool } from '../../tool-types.js';

export const xml_parse: Tool = {
  name: 'xml_parse',
  description: '解析 XML 内容',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'XML 字符串' },
      file_path: { type: 'string', description: 'XML 文件路径' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      let xmlContent = '';
      const filePath = params.file_path as string | undefined;
      const content = params.content as string | undefined;

      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        xmlContent = readFileSync(abs, 'utf-8');
      } else if (content) {
        xmlContent = content;
      } else {
        return { success: false, error: '请提供 content 或 file_path 参数', output: '' };
      }

      const parsed = parseXml(xmlContent);
      return { success: true, output: JSON.stringify(parsed, null, 2) };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function parseXml(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const tagRegex = /<([\w:.-]+)([^>]*)>([\s\S]*?)<\/\1>/g;
  const selfClosingRegex = /<([\w:.-]+)([^>]*)\/>/g;
  let match;

  while ((match = tagRegex.exec(xml)) !== null) {
    const tagName = match[1];
    const attrs = match[2];
    const inner = match[3];

    const attrsObj: Record<string, string> = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      attrsObj[attrMatch[1]] = attrMatch[2];
    }

    if (/<[\w]/.test(inner)) {
      result[tagName] = { ...attrsObj, ...parseXml(inner) };
    } else {
      result[tagName] = { _text: inner.trim(), ...attrsObj };
    }
  }

  while ((match = selfClosingRegex.exec(xml)) !== null) {
    const attrsObj: Record<string, string> = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(match[2])) !== null) {
      attrsObj[attrMatch[1]] = attrMatch[2];
    }
    result[match[1]] = attrsObj;
  }

  return result;
}
