import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const edit_file: Tool = {
  name: 'edit_file',
  description: '通过搜索替换编辑文件内容',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件绝对路径' },
      old_str: { type: 'string', description: '要替换的源字符串' },
      new_str: { type: 'string', description: '替换后的字符串' },
      replace_all: { type: 'boolean', description: '是否替换所有匹配项' },
    },
    required: ['file_path', 'old_str', 'new_str'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const filePath = resolve(params.file_path as string);
      const oldStr = params.old_str as string;
      const newStr = params.new_str as string;
      const replaceAll = (params.replace_all as boolean) ?? false;
      if (!existsSync(filePath)) return { success: false, error: `文件不存在: ${filePath}`, output: '' };
      const content = readFileSync(filePath, 'utf-8');
      const index = content.indexOf(oldStr);
      if (index === -1) return { success: false, error: '未找到匹配的字符串', output: '' };
      let replaced: string; let count: number;
      if (replaceAll) {
        const regex = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const before = content;
        replaced = content.replace(regex, newStr.replace(/\$/g, '$$$$'));
        count = (before.match(regex) || []).length;
      } else {
        replaced = content.slice(0, index) + newStr + content.slice(index + oldStr.length);
        count = 1;
      }
      writeFileSync(filePath, replaced, 'utf-8');
      return { success: true, output: `已替换 ${count} 处匹配: ${filePath}` };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
