import type { Tool } from '../../tool-types.js';

export const chart_generate: Tool = {
  name: 'chart_generate',
  description: '生成数据图表（输出图表描述和配置）',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'JSON 格式的数据' },
      chart_type: { type: 'string', description: '图表类型: bar, line, pie, scatter, area', enum: ['bar', 'line', 'pie', 'scatter', 'area'] },
      x_key: { type: 'string', description: 'X 轴数据键名' },
      y_key: { type: 'string', description: 'Y 轴数据键名' },
      title: { type: 'string', description: '图表标题' },
    },
    required: ['data', 'chart_type'],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const data = JSON.parse(params.data as string);
      const chartType = params.chart_type as string;
      const xKey = params.x_key as string | undefined;
      const yKey = params.y_key as string | undefined;
      const title = (params.title as string) ?? 'Chart';

      const config = {
        title,
        type: chartType,
        data: Array.isArray(data) ? data : [data],
        xKey,
        yKey,
        timestamp: new Date().toISOString(),
      };

      const output = [
        `图表配置: ${title} (${chartType})`,
        '',
        '```json',
        JSON.stringify(config, null, 2),
        '```',
        '',
        '提示: 可以使用以下工具渲染图表:',
        '- Chart.js + Canvas (Node.js)',
        '- Apache ECharts',
        '- D3.js',
        '- Matplotlib (Python)',
        '',
        '使用建议: 安装 chartjs-node-canvas 或使用 web 前端渲染。',
      ].join('\n');

      return {
        success: true,
        output,
        metadata: { chartType, dataPoints: Array.isArray(data) ? data.length : 1 },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
