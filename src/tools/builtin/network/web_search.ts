import type { Tool } from '../../tool-types.js';

export const web_search: Tool = {
  name: 'web_search',
  description: '使用 Bing 搜索引擎查询，返回真实搜索结果摘要',
  category: 'network',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询关键词' },
      count: { type: 'number', description: '返回结果数 (默认 5, 最多 10)' },
    },
    required: ['query'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const query = params.query as string;
      const count = Math.min((params.count as number) ?? 5, 10);
      const encoded = encodeURIComponent(query);
      const url = `https://www.bing.com/search?q=${encoded}&count=${count}`;

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!resp.ok) {
        return { success: false, error: `Bing 搜索失败: HTTP ${resp.status}`, output: '' };
      }

      const html = await resp.text();
      const results = extractBingResults(html, count);

      if (results.length === 0) {
        return {
          success: true,
          output: `Bing 搜索 "${query}" — 未提取到结果\n直接访问: ${url}`,
          metadata: { query, engine: 'bing', url },
        };
      }

      const lines = [`Bing 搜索: "${query}"`, ''];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`${i + 1}. ${r.title}`);
        lines.push(`   ${r.snippet}`);
        lines.push(`   ${r.url}`);
        lines.push('');
      }

      return {
        success: true,
        output: lines.join('\n'),
        metadata: { query, engine: 'bing', count: results.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function extractBingResults(html: string, maxCount: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Bing 搜索结果在 <li class="b_algo"> 或 <div class="b_caption"> 中
  const algoRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  const matches = html.match(algoRegex);

  if (matches) {
    for (const block of matches.slice(0, maxCount)) {
      const r = parseAlgoBlock(block);
      if (r) results.push(r);
    }
  }

  // 回退: 直接抓标题链接
  if (results.length === 0) {
    const linkRegex = /<h2[^>]*><a[^>]*href="(https?:\/\/(?!www\.bing\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null && results.length < maxCount) {
      const url = m[1]!.replace(/&amp;/g, '&');
      const title = m[2]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
      const snippet = extractSnippet(html, url);
      results.push({ title: title.slice(0, 120), url: url.slice(0, 200), snippet: snippet.slice(0, 200) });
    }
  }

  return results;
}

function parseAlgoBlock(block: string): SearchResult | null {
  const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/i);
  if (!titleMatch) return null;

  const url = titleMatch[1]!.replace(/&amp;/g, '&').slice(0, 200);
  const title = titleMatch[2]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

  // 尝试多种摘要容器
  const snippetMatch = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || block.match(/<div class="b_caption"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i)
    || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

  const snippet = snippetMatch
    ? snippetMatch[1]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
    : '';

  return { title: title.slice(0, 120), url, snippet: snippet.slice(0, 200) };
}

function extractSnippet(html: string, _url: string): string {
  // 简单回退: 找标题附近的文本
  const idx = html.indexOf(_url) + _url.length;
  const nearby = html.slice(idx, idx + 500);
  const text = nearby.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 200);
}
