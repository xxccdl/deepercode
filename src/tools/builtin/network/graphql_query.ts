import type { Tool } from '../../tool-types.js';

export const graphql_query: Tool = {
  name: 'graphql_query',
  description: '执行 GraphQL 查询',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'GraphQL 端点 URL' },
      query: { type: 'string', description: 'GraphQL 查询语句' },
      variables: { type: 'object', description: '查询变量' },
      headers: { type: 'object', description: '自定义请求头' },
    },
    required: ['url', 'query'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const query = params.query as string;
      const variables = params.variables as Record<string, unknown> | undefined;
      const headers = (params.headers as Record<string, string>) ?? {};

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeeperCode/1.0',
          ...headers,
        },
        body: JSON.stringify({ query, variables: variables || undefined }),
      });

      const data = await res.json() as Record<string, unknown>;
      return {
        success: res.ok && !data.errors,
        output: JSON.stringify(data, null, 2).slice(0, 50000),
        metadata: { status: res.status, hasErrors: !!data.errors },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
