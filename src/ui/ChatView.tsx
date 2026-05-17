import { useEffect, useState, useRef } from 'react';
import { Text, Box, useStdin } from 'ink';
import { MessageBubble } from './MessageBubble.tsx';
import { defaultTheme } from './themes/default.ts';
import { eventbus } from '../core/eventbus.ts';
import type { ChatMessage } from '../model/types.ts';
import readline from 'node:readline';

interface ChatViewProps {
  initialMessages?: ChatMessage[];
  apiKey?: string;
  model?: string;
}

const HISTORY_MAX = 100;
const history: string[] = [];

const SLASH_RESULTS: Record<string, string> = {
  '/help': '命令: /help /clear /quit /config /model /tools /export /theme',
  '/clear': '__CLEAR__',
  '/quit': '__QUIT__',
  '/config': '打开配置: deeper config list | deeper config set <key> <value>',
  '/model': '模型: deepseek-v4-pro / v4-flash',
  '/tools': '105 个内置工具已就绪',
  '/export': '对话导出功能开发中',
  '/theme': '主题: dark | 切换: deeper config set theme light',
};

export function ChatView({ initialMessages = [], apiKey, model }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [thinking, setThinking] = useState(false);
  const keyRef = useRef(apiKey);
  const modelRef = useRef(model || 'deepseek-v4-pro');
  keyRef.current = apiKey;

  useEffect(() => {
    const onMsg = (p: { id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }) => {
      setMessages(prev => [...prev, { ...p }]);
    };
    const onClear = () => { setMessages([]); setThinking(false); };
    eventbus.onMessageReceived(onMsg);
    eventbus.onAppClear(onClear);
    return () => { eventbus.removeAllListeners(); };
  }, []);

  const handleSubmit = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (SLASH_RESULTS[trimmed]) {
      const r = SLASH_RESULTS[trimmed];
      if (r === '__QUIT__') { eventbus.emitAppQuit(); return; }
      if (r === '__CLEAR__') { setMessages([]); return; }
      setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: 'system', content: r, timestamp: Date.now() }]);
      return;
    }

    history.push(trimmed);
    if (history.length > HISTORY_MAX) history.shift();

    const um: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() };
    setMessages(prev => [...prev, um]);
    eventbus.emitMessageSend({ content: trimmed });

    const currentKey = keyRef.current || '';
    if (!currentKey) {
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'system',
        content: '⚠ 未配置 API Key。\n\n请运行以下命令配置:\n  deeper config set apiKey "sk-你的DeepSeek密钥"\n\n获取密钥: https://platform.deepseek.com',
        timestamp: Date.now(),
      }]);
      return;
    }

    setThinking(true);
    callDeepSeek(trimmed, currentKey, modelRef.current, messages)
      .then(responseText => {
        setThinking(false);
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`, role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        }]);
      })
      .catch(err => {
        setThinking(false);
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`, role: 'system',
          content: `❌ API 请求失败: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        }]);
      });
  };

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1}>
        {messages.length === 0 && !thinking ? (
          <Box flexDirection="column" paddingY={1}>
            <Box>
              <Text bold color={defaultTheme.primary}>DeeperCode</Text>
              <Text dimColor> — 一句话生成完整项目</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>输入你的任务或 /help 查看命令</Text>
            </Box>
          </Box>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
        ))}

        {thinking ? (
          <Box marginY={1}><Text dimColor>思考中...</Text></Box>
        ) : null}
      </Box>

      <InputLine onSubmit={handleSubmit} />
    </Box>
  );
}

async function callDeepSeek(
  prompt: string,
  apiKey: string,
  model: string,
  history: ChatMessage[],
): Promise<string> {
  const systemMsg = {
    role: 'system',
    content: '你是 DeeperCode AI 编程助手，基于 DeepSeek-V4-Pro。你擅长编写代码、调试、项目构建和技术问题解答。请用中文回复，代码保持原样。',
  };

  const recentHistory = history.slice(-20).map(m => ({
    role: m.role === 'system' ? 'system' : m.role,
    content: m.content || '',
  }));

  const messages = [systemMsg, ...recentHistory, { role: 'user', content: prompt }];

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('API Key 无效或已过期，请检查配置');
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '(空响应)';
}

function InputLine({ onSubmit }: { onSubmit: (v: string) => void }) {
  const { stdin } = useStdin();
  const [buf, setBuf] = useState('');
  const bufRef = useRef('');
  bufRef.current = buf;
  const histIdx = useRef(-1);
  const cursorRef = useRef(0);

  useEffect(() => {
    if (!stdin) return;

    readline.emitKeypressEvents(stdin as unknown as NodeJS.ReadableStream);

    const onKP = (str: string | undefined, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        eventbus.emitAppQuit();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (bufRef.current.trim()) {
          onSubmit(bufRef.current);
        }
        bufRef.current = '';
        cursorRef.current = 0;
        setBuf('');
        histIdx.current = -1;
        return;
      }

      if (key.name === 'backspace') {
        if (cursorRef.current > 0) {
          const prev = bufRef.current;
          bufRef.current = prev.slice(0, cursorRef.current - 1) + prev.slice(cursorRef.current);
          cursorRef.current = Math.max(0, cursorRef.current - 1);
          setBuf(bufRef.current);
        }
        return;
      }

      if (key.name === 'delete') {
        if (cursorRef.current < bufRef.current.length) {
          const prev = bufRef.current;
          bufRef.current = prev.slice(0, cursorRef.current) + prev.slice(cursorRef.current + 1);
          setBuf(bufRef.current);
        }
        return;
      }

      if (key.name === 'left') {
        cursorRef.current = Math.max(0, cursorRef.current - 1);
        return;
      }
      if (key.name === 'right') {
        cursorRef.current = Math.min(bufRef.current.length, cursorRef.current + 1);
        return;
      }
      if (key.name === 'home') { cursorRef.current = 0; return; }
      if (key.name === 'end') { cursorRef.current = bufRef.current.length; return; }

      if (key.name === 'up') {
        if (history.length === 0) return;
        const idx = histIdx.current === -1 ? history.length - 1 : Math.max(0, histIdx.current - 1);
        histIdx.current = idx;
        bufRef.current = history[idx];
        cursorRef.current = bufRef.current.length;
        setBuf(bufRef.current);
        return;
      }

      if (key.name === 'down') {
        if (histIdx.current === -1) return;
        const idx = histIdx.current + 1;
        if (idx >= history.length) {
          histIdx.current = -1;
          bufRef.current = '';
          cursorRef.current = 0;
        } else {
          histIdx.current = idx;
          bufRef.current = history[idx];
          cursorRef.current = bufRef.current.length;
        }
        setBuf(bufRef.current);
        return;
      }

      if (str) {
        const prev = bufRef.current;
        bufRef.current = prev.slice(0, cursorRef.current) + str + prev.slice(cursorRef.current);
        cursorRef.current += str.length;
        setBuf(bufRef.current);
        histIdx.current = -1;
      }
    };

    (stdin as any).on('keypress', onKP);
    return () => { (stdin as any).removeListener('keypress', onKP); };
  }, []);

  const before = buf.slice(0, cursorRef.current);
  const at = buf[cursorRef.current] || ' ';
  const after = buf.slice(cursorRef.current + 1);

  return (
    <Box paddingX={1}>
      <Text color={defaultTheme.primary} bold>❯ </Text>
      <Text>{before}</Text>
      <Text inverse>{at}</Text>
      <Text>{after}</Text>
    </Box>
  );
}
