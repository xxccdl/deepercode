import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const parse_ast: Tool = {
  name: 'parse_ast',
  description: '解析代码结构（简化 AST 分析）',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '源代码文件路径' },
      language: { type: 'string', description: '语言类型: typescript, javascript, python', enum: ['typescript', 'javascript', 'python'] },
    },
    required: ['file_path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const language = (params.language as string) ?? 'typescript';

      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const functions: string[] = [];
      const classes: string[] = [];
      const imports: string[] = [];
      const exports: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        if (/^(export\s+)?(async\s+)?function\s+(\w+)/i.test(line)) {
          functions.push(`${lineNum}: ${line.slice(0, 120)}`);
        }
        if (/^(export\s+)?class\s+(\w+)/i.test(line)) {
          classes.push(`${lineNum}: ${line.slice(0, 120)}`);
        }
        if (/^(import\s+|from\s+|require\()/i.test(line)) {
          imports.push(`${lineNum}: ${line.slice(0, 120)}`);
        }
        if (/^export\s+/.test(line)) {
          exports.push(`${lineNum}: ${line.slice(0, 120)}`);
        }
      }

      const output = [
        `=== 代码结构分析: ${filePath} ===`,
        `语言: ${language} | 行数: ${lines.length}`,
        '',
        `--- 函数 (${functions.length}) ---`,
        ...functions.slice(0, 50),
        '',
        `--- 类 (${classes.length}) ---`,
        ...classes.slice(0, 20),
        '',
        `--- 导入 (${imports.length}) ---`,
        ...imports.slice(0, 30),
        '',
        `--- 导出 (${exports.length}) ---`,
        ...exports.slice(0, 30),
      ].join('\n');

      return {
        success: true,
        output,
        metadata: {
          functions: functions.length,
          classes: classes.length,
          imports: imports.length,
          exports: exports.length,
          lines: lines.length,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
