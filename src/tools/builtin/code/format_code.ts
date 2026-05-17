import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const format_code: Tool = {
  name: 'format_code',
  description: '格式化代码（建议使用 prettier）',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件路径' },
      language: { type: 'string', description: '语言类型', enum: ['typescript', 'javascript', 'json', 'css', 'html', 'python'] },
    },
    required: ['file_path'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const language = (params.language as string) ?? 'typescript';

      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }

      try {
        const { execSync } = await import('node:child_process');
        const ext = filePath.split('.').pop() ?? 'ts';
        execSync(`npx prettier --write "${filePath}"`, {
          encoding: 'utf-8',
          timeout: 30000,
          stdio: 'pipe',
        });
        const formatted = readFileSync(filePath, 'utf-8');
        return {
          success: true,
          output: `已格式化: ${filePath}\n\n${formatted.slice(0, 10000)}`,
          metadata: { formatted: true, tool: 'prettier' },
        };
      } catch {
        const content = readFileSync(filePath, 'utf-8');
        return {
          success: true,
          output: `代码格式化建议 (${language}):\n\n` +
            '- 运行 npx prettier --write . 来批量格式化\n' +
            '- 使用 ESLint: npx eslint --fix .\n\n' +
            `当前文件内容:\n${content.slice(0, 10000)}`,
          metadata: { formatted: false, suggestion: 'prettier' },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
