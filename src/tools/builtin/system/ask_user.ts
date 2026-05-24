import type { Tool } from '../../tool-types.js';

export interface AskUserQuestion {
  question: string;
  header?: string;
  options?: string[];
  multiSelect?: boolean;
}

type AskFn = (q: AskUserQuestion) => Promise<string>;

let askFn: AskFn | null = null;

export function setAskUserFn(fn: AskFn): void {
  askFn = fn;
}

export const ask_user: Tool = {
  name: 'ask_user',
  description: '向用户提问，用于需要用户决策时。提供 question(必填)、options(可选选项列表)、multiSelect(多选) 等参数。选项模式下用户选择编号返回；自由模式下返回用户文本。',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '向用户提出的问题' },
      header: { type: 'string', description: '问题标题 / 分类标签' },
      options: { type: 'array', items: { type: 'string' }, description: '可选项列表，提供后用户选择编号' },
      multiSelect: { type: 'boolean', description: '是否允许多选（仅 options 模式下有效）' },
    },
    required: ['question'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    const question = params.question as string;
    const header = (params.header as string) || undefined;
    const options = params.options as string[] | undefined;
    const multiSelect = params.multiSelect as boolean | undefined;

    if (!question || question.trim().length < 2) {
      return { success: false, error: '请提供有效的问题', output: '' };
    }

    if (!askFn) {
      return { success: false, error: 'ask_user 未初始化（交互模式下可用）', output: '' };
    }

    try {
      const answer = await askFn({ question, header, options, multiSelect });
      return { success: true, output: answer, metadata: { question: question.slice(0, 100), hasOptions: !!options } };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, output: '用户取消了回答' };
    }
  },
};
