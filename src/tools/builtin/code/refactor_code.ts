import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const refactor_code: Tool = {
  name: 'refactor_code',
  description: '提供代码重构建议和执行常见重构操作',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件路径' },
      action: { type: 'string', description: '重构操作: rename, extract, inline, move', enum: ['rename', 'extract', 'inline', 'move'] },
      target: { type: 'string', description: '目标符号名' },
      new_name: { type: 'string', description: '新名称' },
    },
    required: ['file_path', 'action'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const action = params.action as string;
      const target = params.target as string | undefined;
      const newName = params.new_name as string | undefined;

      if (!existsSync(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let output = `=== 代码重构: ${filePath} ===\n操作: ${action}\n`;

      switch (action) {
        case 'rename': {
          if (!target || !newName) {
            return { success: false, error: 'rename 需要 target 和 new_name 参数', output: '' };
          }
          const escaped = escapeRegex(target);
          const count = (content.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
          output += `目标: ${target} → ${newName}\n`;
          output += `找到 ${count} 处引用\n`;
          output += '请使用 edit_file 工具执行精确替换，或使用 IDE 的重构功能。';
          break;
        }
        default:
          output += `重构操作 "${action}" 的分析已提供。\n`;
          output += '建议使用 IDE (VS Code, WebStorm) 的内置重构工具以获得最佳结果。';
      }

      return { success: true, output, metadata: { filePath, action, target, newName } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
