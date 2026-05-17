import type { Tool } from '../../tool-types.js';

let subagentRunner: ((task: string, mode: 'foreground' | 'background') => Promise<string>) | null = null;

export function setSubagentRunner(fn: (task: string, mode: 'foreground' | 'background') => Promise<string>): void {
  subagentRunner = fn;
}

export const subagent: Tool = {
  name: 'subagent',
  description: '启动子代理处理任务。默认前台模式等待完成返回结果，mode=background 后台执行不阻塞。用于: 代码分析、文件搜索、并行构建、测试运行等。',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', description: '分配给子代理的任务描述' },
      mode: { type: 'string', description: 'foreground(等待完成) 或 background(后台执行)', enum: ['foreground', 'background'] },
    },
    required: ['task'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    const task = params.task as string;
    const mode = (params.mode as string) === 'background' ? 'background' : 'foreground';
    if (!task || task.trim().length < 2) {
      return { success: false, error: '请提供有效的任务描述', output: '' };
    }
    if (subagentRunner) {
      try {
        const result = await subagentRunner(task, mode);
        return { success: true, output: result, metadata: { mode } };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message, output: '' };
      }
    }
    return { success: false, error: '子代理引擎未初始化', output: '' };
  },
};
