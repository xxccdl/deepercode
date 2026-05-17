import type { Tool } from '../../tool-types.js';

export const browser_action: Tool = {
  name: 'browser_action',
  description: '执行浏览器操作（CLI 环境限制）',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: open, close, navigate, click, type, screenshot', enum: ['open', 'close', 'navigate', 'click', 'type', 'screenshot'] },
      url: { type: 'string', description: '页面 URL' },
      selector: { type: 'string', description: 'CSS 选择器' },
      value: { type: 'string', description: '输入值' },
    },
    required: ['action'],
  },
  dangerous: true,
  requiresApproval: true,
  async execute(params) {
    try {
      const action = params.action as string;
      const url = params.url as string | undefined;

      switch (action) {
        case 'open': {
          if (url) {
            const openMod = await import('open');
            await openMod.default(url);
            return { success: true, output: `已在默认浏览器打开: ${url}`, metadata: { action, url } };
          }
          return { success: false, error: '缺少 url 参数', output: '' };
        }
        case 'navigate': {
          if (url) {
            return {
              success: true,
              output: `浏览器导航请求: ${url}\n注意: 当前为 CLI 环境，完整浏览器操作需 GUI 支持。`,
              metadata: { action, url },
            };
          }
          return { success: false, error: '缺少 url 参数', output: '' };
        }
        default:
          return {
            success: true,
            output: `浏览器操作 "${action}" 请求已记录。\n当前为 CLI 环境，完整浏览器自动化需 Playwright/Puppeteer 支持。`,
            metadata: { action, url, cliMode: true },
          };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
