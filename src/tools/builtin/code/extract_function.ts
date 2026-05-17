import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const extract_function: Tool = {
  name: 'extract_function',
  description: '从代码中提取指定函数',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件路径' },
      function_name: { type: 'string', description: '函数名' },
    },
    required: ['file_path', 'function_name'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const funcName = params.function_name as string;

      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const funcRegex = new RegExp(
        `(?:function\\s+${escapeRegex(funcName)}|` +
        `(?:const|let|var)\\s+${escapeRegex(funcName)}\\s*=|` +
        `(?:public|private|protected|static|async\\s+)?${escapeRegex(funcName)}\\s*\\([^)]*\\)\\s*[\\{:]|` +
        `(?:export\\s+)?(?:async\\s+)?${escapeRegex(funcName)}\\s*\\([^)]*\\)\\s*[\\{:]|` +
        `(?:get |set )?${escapeRegex(funcName)}\\s*\\([^)]*\\)\\s*\\{)`,
      );

      let startLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (funcRegex.test(lines[i])) {
          startLine = i;
          break;
        }
      }

      if (startLine === -1) {
        return { success: false, error: `未找到函数: ${funcName}`, output: '' };
      }

      let braceCount = 0;
      let endLine = -1;
      for (let i = startLine; i < lines.length; i++) {
        for (const ch of lines[i]) {
          if (ch === '{') braceCount++;
          else if (ch === '}') {
            braceCount--;
            if (braceCount === 0) {
              endLine = i;
              break;
            }
          }
        }
        if (endLine !== -1) break;
      }

      if (endLine === -1) {
        endLine = Math.min(startLine + 50, lines.length - 1);
      }

      const extracted = lines.slice(startLine, endLine + 1).join('\n');

      return {
        success: true,
        output: `提取函数 "${funcName}" (${filePath}:${startLine + 1}-${endLine + 1}):\n\n${extracted}`,
        metadata: { functionName: funcName, file: filePath, startLine: startLine + 1, endLine: endLine + 1 },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
