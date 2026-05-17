import type { Tool } from '../../tool-types.js';

export const context_summarize: Tool = {
  name: 'context_summarize',
  description: '对长文本进行摘要',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要摘要的文本' },
      file_path: { type: 'string', description: '文件路径' },
      max_length: { type: 'number', description: '摘要最大长度（字符）' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const text = params.text as string | undefined;
      const filePath = params.file_path as string | undefined;
      const maxLength = (params.max_length as number) ?? 500;

      let content = '';
      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        content = readFileSync(abs, 'utf-8');
      } else if (text) {
        content = text;
      } else {
        return { success: false, error: '请提供 text 或 file_path 参数', output: '' };
      }

      const lines = content.split('\n');
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const summary = extractSummary(content, maxLength);

      const output = [
        `=== 上下文摘要 ===`,
        `原文: ${lines.length} 行, ${words.length} 词, ${content.length} 字符`,
        '',
        summary,
      ].join('\n');

      return {
        success: true,
        output,
        metadata: { originalLength: content.length, summaryLength: summary.length, lines: lines.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function extractSummary(text: string, maxLen: number): string {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const important = sentences
    .filter(s => s.trim().length > 10)
    .slice(0, 10);

  if (important.join(' ').length <= maxLen) {
    return important.join(' ').trim();
  }

  let result = important[0];
  for (let i = 1; i < important.length; i++) {
    if (result.length + important[i].length > maxLen) break;
    result += ' ' + important[i];
  }

  return result.trim() + (result.length < text.length ? '...' : '');
}
