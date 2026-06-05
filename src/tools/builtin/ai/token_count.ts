import type { Tool } from '../../tool-types.js';

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{f900}-\u{faff}\u{2f800}-\u{2fa1f}]/gu;
const HANGUL_RE = /[\uac00-\ud7af]/g;
const JAPANESE_RE = /[\u3040-\u309f\u30a0-\u30ff]/g;
const CJK_PUNCT_RE = /[\u3000-\u303f\uff00-\uffef]/g;

export function estimateTokens(text: string): number {
  if (!text) return 0;

  let tokens = 0;

  const cjk = text.match(CJK_RE);
  if (cjk) tokens += Math.ceil(cjk.length * 1.6);

  const hangul = text.match(HANGUL_RE);
  if (hangul) tokens += Math.ceil(hangul.length * 1.5);

  const jp = text.match(JAPANESE_RE);
  if (jp) tokens += Math.ceil(jp.length * 1.4);

  const cjkp = text.match(CJK_PUNCT_RE);
  if (cjkp) tokens += cjkp.length;

  let ascii = text;
  ascii = ascii.replace(CJK_RE, '');
  ascii = ascii.replace(HANGUL_RE, '');
  ascii = ascii.replace(JAPANESE_RE, '');
  ascii = ascii.replace(CJK_PUNCT_RE, '');

  const nls = ascii.split('\n').length - 1;
  tokens += nls;

  const lines = ascii.split('\n');
  for (const line of lines) {
    if (!line.trim()) { tokens += 1; continue; }

    const symbols = (line.match(/[{}()\[\];:'"`,.<>\/\\|&^~`@#$%*+=\-!?]/g) || []).length;
    const digits = (line.match(/\d+/g) || []).join('').length;
    const words = line.match(/[a-zA-Z_]+/g) || [];

    const wordTokens = (words as string[]).reduce((s: number, w: string) => {
      if (w.length <= 4) return s + 1;
      return s + Math.ceil(w.length / 3.5);
    }, 0);

    const digitTokens = Math.ceil(digits / 3);
    const symbolTokens = Math.ceil(symbols / 1.8);

    tokens += wordTokens + digitTokens + symbolTokens;
  }

  return Math.max(1, Math.floor(tokens * 1.1));
}

export interface ContextBreakdown {
  total: number;
  systemTokens: number;
  historyTokens: number;
  toolTokens: number;
  xmemoryTokens: number;
  deeperMdTokens: number;
  rulesTokens: number;
  percentUsed: number;
  historyCount: number;
  memoryCount: number;
}

let cachedBreakdown: ContextBreakdown | null = null;
let cachedBreakdownMs = 0;

export function estimateContextBreakdown(
  messages: Array<Record<string, unknown>>,
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>,
  overrides?: { xmemoryTokens?: number; deeperMdTokens?: number; rulesTokens?: number; memoryCount?: number; historyCount?: number },
): ContextBreakdown {
  const now = Date.now();
  if (cachedBreakdown && (now - cachedBreakdownMs) < 200) return cachedBreakdown;

  let total = 8;
  let systemTokens = 8;
  let historyTokens = 0;

  for (const msg of messages) {
    total += 3;
    const content = msg.content as string | null | undefined;
    if (content) {
      const ct = estimateTokens(content);
      if (msg.role === 'system') systemTokens += ct;
      else historyTokens += ct;
      total += ct;
    }

    const toolCalls = msg.tool_calls as Array<{ function?: { name?: string; arguments?: string } }> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const tct = estimateTokens(tc.function?.name || '') + estimateTokens(tc.function?.arguments || '') + 4;
        historyTokens += tct;
        total += tct;
      }
    }

    const toolCallId = msg.tool_call_id as string | undefined;
    if (toolCallId) { total += estimateTokens(toolCallId) + 2; historyTokens += estimateTokens(toolCallId) + 2; }
  }

  let toolTokens = 0;
  if (tools) {
    for (const t of tools) {
      const tt = estimateTokens(t.function.name) + estimateTokens(t.function.description) + estimateTokens(JSON.stringify(t.function.parameters)) + 4;
      toolTokens += tt;
      total += tt;
    }
  }

  const xmTok = overrides?.xmemoryTokens ?? 0;
  const dmTok = overrides?.deeperMdTokens ?? 0;
  const rTok = overrides?.rulesTokens ?? 0;
  total += xmTok + dmTok + rTok;
  systemTokens += xmTok + dmTok + rTok;

  cachedBreakdown = {
    total,
    systemTokens,
    historyTokens,
    toolTokens,
    xmemoryTokens: xmTok,
    deeperMdTokens: dmTok,
    rulesTokens: rTok,
    percentUsed: 0,
    historyCount: overrides?.historyCount ?? 0,
    memoryCount: overrides?.memoryCount ?? 0,
  };
  cachedBreakdownMs = now;
  return cachedBreakdown;
}

export function estimateMessageTokens(
  messages: Array<Record<string, unknown>>,
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>,
): number {
  return estimateContextBreakdown(messages, tools).total;
}

export const token_count: Tool = {
  name: 'token_count',
  description: '计算文本/文件/对话的 Token 数量 (BPE 估算)。支持统计中文、英文、代码的 Token 消耗。',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要计数的文本' },
      file_path: { type: 'string', description: '文件绝对路径' },
      messages: { type: 'string', description: 'JSON 格式的对话消息列表 (可选)' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const text = params.text as string | undefined;
      const filePath = params.file_path as string | undefined;
      const messagesJson = params.messages as string | undefined;

      let content = '';
      if (filePath) {
        const { readFileSync, existsSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const abs = resolve(filePath);
        if (!existsSync(abs)) return { success: false, error: `文件不存在: ${abs}`, output: '' };
        content = readFileSync(abs, 'utf-8');
      } else if (text) {
        content = text;
      } else if (messagesJson) {
        content = messagesJson;
      } else {
        return { success: false, error: '请提供 text、file_path 或 messages 参数', output: '' };
      }

      const chars = content.length;
      const words = content.split(/\s+/).filter(w => w.length > 0).length;
      const lines = content.split('\n').length;
      const hasCJK = CJK_RE.test(content);

      let tokens = 0;
      let msgsEstimate = 0;

      if (messagesJson) {
        try {
          const msgs = JSON.parse(messagesJson) as Array<Record<string, unknown>>;
          msgsEstimate = estimateMessageTokens(msgs);
          tokens = msgsEstimate;
        } catch {
          tokens = estimateTokens(content);
        }
      } else {
        tokens = estimateTokens(content);
      }

      const output = [
        `Token 估算 (BPE):`,
        `总 Token: ${tokens.toLocaleString()}`,
        `字符数:   ${chars.toLocaleString()}`,
        `单词数:   ${words.toLocaleString()}  ${hasCJK ? '(含中文)' : ''}`,
        `行数:     ${lines.toLocaleString()}`,
        `比率:     ${(chars / tokens).toFixed(1)} 字符/Token`,
      ].join('\n');

      return { success: true, output, metadata: { tokens, chars, words, lines, messagesTokens: msgsEstimate } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
