import type { Tool } from '../../tool-types.js';

export const tool_create: Tool = {
  name: 'tool_create',
  description: 'AI 动态创建新工具（通过注册中心）',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '工具名称' },
      description: { type: 'string', description: '工具描述' },
      command: { type: 'string', description: '工具执行的命令' },
      category: { type: 'string', description: '工具分类', enum: ['filesystem', 'search', 'shell', 'network', 'code', 'database', 'data', 'security', 'project', 'ai', 'system'] },
      parameters: { type: 'object', description: '参数 JSON Schema' },
    },
    required: ['name', 'command'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const name = params.name as string;
      const description = (params.description as string) ?? `动态工具: ${name}`;
      const command = params.command as string;
      const category = (params.category as string) ?? 'ai';
      const parameters = params.parameters as Record<string, unknown> | undefined;

      return {
        success: true,
        output: [
          `动态工具创建请求: ${name}`,
          `分类: ${category}`,
          `命令: ${command}`,
          '',
          '工具可以通过 run_command 或 DynamicTool.createFromCommand 注册。',
          '使用示例:',
          '```js',
          `const dynamicTool = dynamicToolRegistry.createFromCommand(`,
          `  '${name}',`,
          `  '${description}',`,
          `  '${command}',`,
          `  '${category}'`,
          ');',
          '```',
        ].join('\n'),
        metadata: { name, category, command },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
