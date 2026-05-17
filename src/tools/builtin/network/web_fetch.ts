import type { Tool } from '../../tool-types.js';

export const web_fetch: Tool = {
  name: 'web_fetch',
  description: '获取网页内容并返回纯文本 / Markdown',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '页面 URL' },
      timeout_ms: { type: 'number', description: '超时毫秒数' },
      max_size: { type: 'number', description: '最大返回字节数' },
      as_markdown: { type: 'boolean', description: '是否尝试返回 Markdown 格式' },
    },
    required: ['url'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const url = params.url as string;
      const timeout = (params.timeout_ms as number) ?? 30000;
      const maxSize = (params.max_size as number) ?? 500000;
      const asMarkdown = (params.as_markdown as boolean) ?? false;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'DeeperCode/1.0 (AI Agent)',
            'Accept': asMarkdown ? 'text/markdown, text/html' : 'text/html',
          },
          signal: controller.signal,
        });

        const contentType = res.headers.get('content-type') ?? '';
        let text = await res.text();

        if (text.length > maxSize) {
          text = text.slice(0, maxSize) + '\n\n[内容已截断]';
        }

        if (asMarkdown || contentType.includes('html')) {
          const cheerio = await import('cheerio');
          const $ = cheerio.load(text);
          $('script, style, nav, footer, iframe, noscript').remove();
          const extracted = $('body').text().replace(/\s+/g, ' ').trim();
          text = `# 页面内容 (${url})\n\nURL: ${url}\nContent-Type: ${contentType}\n\n${extracted}`;
        }

        return {
          success: true,
          output: text,
          metadata: {
            url,
            status: res.status,
            contentType,
            length: text.length,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
