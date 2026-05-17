import type { Tool } from '../../tool-types.js';

export const search_docs: Tool = {
  name: 'search_docs',
  description: '搜索在线文档，返回搜索建议和常用文档链接',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      source: { type: 'string', description: '文档源: mdn, npm, typescript, nodejs, react, all', enum: ['mdn', 'npm', 'typescript', 'nodejs', 'react', 'all'] },
    },
    required: ['query'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const query = params.query as string;
      const source = (params.source as string) ?? 'all';
      const encoded = encodeURIComponent(query);

      const docLinks: Record<string, string> = {
        mdn: `https://developer.mozilla.org/zh-CN/search?q=${encoded}`,
        npm: `https://www.npmjs.com/search?q=${encoded}`,
        typescript: `https://www.typescriptlang.org/search?q=${encoded}`,
        nodejs: `https://nodejs.org/api/all.html`,
        react: `https://react.dev/`,
      };

      const lines: string[] = ['建议访问以下文档搜索：', ''];
      if (source === 'all') {
        for (const [name, url] of Object.entries(docLinks)) {
          lines.push(`- ${name.toUpperCase()}: ${url}`);
        }
      } else {
        lines.push(`- ${docLinks[source]}`);
      }

      lines.push('', `同时可以在 Stack Overflow 搜索: https://stackoverflow.com/search?q=${encoded}`);

      return {
        success: true,
        output: lines.join('\n'),
        metadata: { query, source },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
