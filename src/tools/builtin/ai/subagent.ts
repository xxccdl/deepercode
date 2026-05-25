import type { Tool } from '../../tool-types.js';

let subagentRunner: ((task: string, mode: 'foreground' | 'background') => Promise<string>) | null = null;

export function setSubagentRunner(fn: (task: string, mode: 'foreground' | 'background') => Promise<string>): void {
  subagentRunner = fn;
}

export const subagent: Tool = {
  name: 'subagent',
  description: '启动子代理处理独立任务。可用工具: read/write/edit 文件、glob_find 搜索、codebase_search、web_search/fetch、grep_search、run_command、npm_manage、todo_manager、ask_user 等约20个。默认前台等待结果，mode=background 后台执行不阻塞主代理。适用: 代码分析、文件搜索、批量读取、项目检查等可独立完成的任务。',
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
