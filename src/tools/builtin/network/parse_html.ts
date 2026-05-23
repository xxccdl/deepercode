import type { Tool } from '../../tool-types.js';

export const parse_html: Tool = {
  name: 'parse_html',
  description: '解析 HTML 内容并提取结构化信息',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'HTML 内容' },
      url: { type: 'string', description: '从 URL 获取并解析' },
      selector: { type: 'string', description: 'CSS 选择器' },
      extract: { type: 'string', description: '提取: text, html, links, images, title, meta, headings', enum: ['text', 'html', 'links', 'images', 'title', 'meta', 'headings', 'all'] },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const cheerio = await import('cheerio');
      let html = '';
      const url = params.url as string | undefined;
      const htmlContent = params.html as string | undefined;
      const selector = params.selector as string | undefined;
      const extract = (params.extract as string) ?? 'all';

      if (url) {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DeeperCode/1.0' },
        });
        html = await res.text();
      } else if (htmlContent) {
        html = htmlContent;
      } else {
        return { success: false, error: '请提供 html 或 url 参数', output: '' };
      }

      const $ = cheerio.load(html);
      const result: Record<string, unknown> = {};

      function shouldExtract(key: string): boolean {
        return extract === 'all' || extract === key;
      }

      if (selector) {
        const els = $(selector);
        result.matches = els.length;
        result.text = els.text().trim().slice(0, 10000);
        return { success: true, output: JSON.stringify(result, null, 2), metadata: result };
      }

      if (shouldExtract('title')) {
        result.title = $('title').text().trim();
      }
      if (shouldExtract('meta')) {
        const meta: Record<string, string> = {};
        $('meta[name], meta[property]').each((_, el) => {
          const name = $(el).attr('name') || $(el).attr('property');
          const content = $(el).attr('content');
          if (name && content) meta[name] = content;
        });
        result.meta = meta;
      }
      if (shouldExtract('headings')) {
        const headings: string[] = [];
        $('h1,h2,h3,h4,h5,h6').each((_, el) => {
          headings.push(`${el.tagName}: ${$(el).text().trim()}`);
        });
        result.headings = headings.slice(0, 50);
      }
      if (shouldExtract('links')) {
        const links: Record<string, string> = {};
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href')!;
          const text = $(el).text().trim();
          links[href] = text || '(无文本)';
        });
        result.links = links;
      }
      if (shouldExtract('images')) {
        const images: string[] = [];
        $('img[src]').each((_, el) => {
          images.push($(el).attr('src')!);
        });
        result.images = images.slice(0, 50);
      }
      if (shouldExtract('text')) {
        result.text = $('body').text().trim().replace(/\s+/g, ' ').slice(0, 10000);
      }

      return {
        success: true,
        output: JSON.stringify(result, null, 2),
        metadata: { ...result, htmlSize: html.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
