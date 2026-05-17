import { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';
import { eventbus, type ContextUpdatedPayload } from '../core/eventbus.ts';

function fmtTokens(n: number): string {
  return n > 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function StatusBar() {
  const [st, setSt] = useState<ContextUpdatedPayload>({
    modelName: 'deepseek-v4-pro',
    tokenCount: 0,
    memoryUsage: 0,
    uptime: 0,
  });

  useEffect(() => {
    const h = (p: Partial<ContextUpdatedPayload>) => setSt(prev => ({ ...prev, ...p }));
    eventbus.onStatusUpdate(h);
    eventbus.onContextUpdated(h);
    return () => { eventbus.removeAllListeners(); };
  }, []);

  return (
    <Box flexDirection="row" paddingX={1}>
      <Text dimColor>{st.modelName}</Text>
      <Text dimColor> | Tok: {fmtTokens(st.tokenCount)}</Text>
      <Text dimColor> | Mem: {st.memoryUsage}MB</Text>
      <Text dimColor> | {fmtUptime(st.uptime)}</Text>
      <Text dimColor> | Ctrl+C 退出</Text>
    </Box>
  );
}
