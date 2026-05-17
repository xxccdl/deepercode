import type { Tool } from '../../tool-types.js';

const templates: Record<string, { template: string; description: string }> = {
  'code-review': {
    description: '代码审查提示',
    template: '请审查以下代码的质量、安全性和可读性，并提供改进建议：\n\n语言: {{language}}\n文件: {{file_path}}\n```\n{{code}}\n```\n\n请关注: 代码风格、潜在 bug、安全问题、性能优化。',
  },
  'commit-message': {
    description: '生成 Commit 消息',
    template: '基于以下更改生成一个规范的 commit 消息（Conventional Commits 格式）：\n\n变更摘要: {{summary}}\n文件变更: {{files}}\n\n类型选择: feat, fix, docs, style, refactor, perf, test, chore, ci',
  },
  'generate-tests': {
    description: '生成测试用例',
    template: '为以下代码生成完整的测试用例：\n\n语言: {{language}}\n框架: {{framework}}\n\n```\n{{code}}\n```\n\n请覆盖: 正常情况、边界情况、错误情况。',
  },
  'explain-code': {
    description: '解释代码',
    template: '请详细解释以下代码的功能和实现原理：\n\n语言: {{language}}\n用途: {{purpose}}\n\n```\n{{code}}\n```\n\n请说明: 整体逻辑、关键变量、函数作用、潜在问题。',
  },
};

export const prompt_template: Tool = {
  name: 'prompt_template',
  description: '管理 AI Prompt 模板',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      template: { type: 'string', description: '模板名称', enum: [...Object.keys(templates), 'list'] },
      params: { type: 'object', description: '模板参数' },
    },
    required: ['template'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const templateName = params.template as string;
      const templateParams = params.params as Record<string, string> | undefined;

      if (templateName === 'list') {
        const list = Object.entries(templates).map(([name, t]) => `  ${name}: ${t.description}`);
        return {
          success: true,
          output: `可用模板 (${Object.keys(templates).length}):\n${list.join('\n')}`,
          metadata: { templates: Object.keys(templates) },
        };
      }

      const tmpl = templates[templateName];
      if (!tmpl) {
        return { success: false, error: `未知模板: ${templateName}`, output: '' };
      }

      let rendered = tmpl.template;
      if (templateParams) {
        for (const [key, value] of Object.entries(templateParams)) {
          rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
        }
      }

      return {
        success: true,
        output: rendered,
        metadata: { template: templateName, rendered: !!templateParams },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
