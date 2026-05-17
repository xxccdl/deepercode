import type { Tool } from '../../tool-types.js';

export const generate_code: Tool = {
  name: 'generate_code',
  description: 'AI 辅助代码生成（提供代码模板和最佳实践）',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string', description: '功能描述' },
      language: { type: 'string', description: '语言类型', enum: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'] },
      template: { type: 'string', description: '模板类型: function, class, component, api, test', enum: ['function', 'class', 'component', 'api', 'test'] },
      file_path: { type: 'string', description: '输出文件路径' },
    },
    required: ['description'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const description = params.description as string;
      const language = (params.language as string) ?? 'typescript';
      const template = (params.template as string) ?? 'function';
      const filePath = params.file_path as string | undefined;

      const output = [
        `代码生成请求: ${language}/${template}`,
        `描述: ${description}`,
        filePath ? `输出: ${filePath}` : '',
        '',
        '此工具由 AI Agent 调用。生成代码由 AI 模型在上下文中完成。',
        '以下是相关的最佳实践建议:',
        '',
        ...getBestPractices(language, template),
      ].filter(Boolean).join('\n');

      return {
        success: true,
        output,
        metadata: { description, language, template, filePath },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function getBestPractices(lang: string, tmpl: string): string[] {
  const tips: string[] = [];
  if (lang === 'typescript') {
    tips.push('- 使用 strict 模式，避免 any 类型');
    tips.push('- 优先使用 interface/type 定义数据结构');
  }
  if (tmpl === 'function') {
    tips.push('- 单一职责，每个函数只做一件事');
    tips.push('- 添加类型标注和参数验证');
  }
  if (tmpl === 'class') {
    tips.push('- 使用 private/public 控制访问');
    tips.push('- 考虑使用 composition 替代 inheritance');
  }
  if (tmpl === 'component') {
    tips.push('- 拆分大组件为小组件');
    tips.push('- 使用 hooks 管理状态');
  }
  if (tmpl === 'api') {
    tips.push('- 实现输入验证和错误处理');
    tips.push('- 添加请求日志和限流');
  }
  if (tmpl === 'test') {
    tips.push('- 遵循 AAA 模式 (Arrange, Act, Assert)');
    tips.push('- 每个测试只测一个行为');
  }
  return tips;
}
