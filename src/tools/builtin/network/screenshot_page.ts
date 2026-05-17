import type { Tool } from '../../tool-types.js';

export const screenshot_page: Tool = {
  name: 'screenshot_page',
  description: '网页截图（CLI 环境下返回页面信息）',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '网页 URL' },
      full_page: { type: 'boolean', description: '是否全页截图' },
      viewport_width: { type: 'number', description: '视口宽度' },
      viewport_height: { type: 'number', description: '视口高度' },
    },
    required: ['url'],
  },
  dangerous: true,
  requiresApproval: true,
  async execute(params) {
    try {
      const url = params.url as string;
      const fullPage = (params.full_page as boolean) ?? false;
      const width = (params.viewport_width as number) ?? 1280;
      const height = (params.viewport_height as number) ?? 800;

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DeeperCode/1.0 Screenshot' },
        });
        const html = await res.text();
        const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '无标题';

        return {
          success: true,
          output: [
            `网页截图请求: ${url}`,
            `标题: ${title}`,
            `视口: ${width}x${height}`,
            `全页: ${fullPage}`,
            `HTML 大小: ${html.length} bytes`,
            '',
            '注意: 当前运行在 CLI 环境，截图功能需要浏览器环境支持。',
            '建议使用 Playwright/Puppeteer 或启用 GUI 模式。',
          ].join('\n'),
          metadata: { url, title, viewport: `${width}x${height}`, fullPage },
        };
      } catch {
        return {
          success: true,
          output: `截图功能当前不可用，请使用浏览器工具获取页面: ${url}`,
          metadata: { url, fallback: true },
        };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
