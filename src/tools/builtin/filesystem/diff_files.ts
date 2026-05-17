import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const diff_files: Tool = {
  name: 'diff_files',
  description: '比较两个文件的差异',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      file_a: { type: 'string', description: '文件A路径' },
      file_b: { type: 'string', description: '文件B路径' },
      context_lines: { type: 'number', description: '上下文行数' },
    },
    required: ['file_a', 'file_b'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const fileA = resolve(params.file_a as string);
      const fileB = resolve(params.file_b as string);
      const contextLines = (params.context_lines as number) ?? 3;
      if (!existsSync(fileA)) return { success: false, error: `文件A不存在: ${fileA}`, output: '' };
      if (!existsSync(fileB)) return { success: false, error: `文件B不存在: ${fileB}`, output: '' };
      const contentA = readFileSync(fileA, 'utf-8');
      const contentB = readFileSync(fileB, 'utf-8');
      const Diff = await import('diff');
      const patch = Diff.structuredPatch(
        fileA, fileB, contentA, contentB,
        'a', 'b',
        { context: contextLines }
      );
      let output = '';
      for (const hunk of patch.hunks) {
        output += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
        for (const line of hunk.lines) {
          output += line + '\n';
        }
      }
      return { success: true, output: output || '文件内容相同' };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
