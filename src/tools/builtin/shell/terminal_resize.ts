import type { Tool } from '../../tool-types.js';

export const terminal_resize: Tool = {
  name: 'terminal_resize',
  description: '调整终端尺寸',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      rows: { type: 'number', description: '行数' },
      cols: { type: 'number', description: '列数' },
    },
    required: ['rows', 'cols'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const rows = params.rows as number;
      const cols = params.cols as number;
      process.stdout.write(`\x1b[8;${rows};${cols}t`);
      return {
        success: true,
        output: `终端尺寸已调整: ${cols}x${rows}`,
        metadata: { rows, cols },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
