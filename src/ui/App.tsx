import { useEffect, useState, useRef } from 'react';
import { Text, Box } from 'ink';
import { ChatView } from './ChatView.tsx';
import { StatusBar } from './StatusBar.tsx';
import { eventbus } from '../core/eventbus.ts';
import type { ChatMessage } from '../model/types.ts';

interface AppProps {
  apiKey?: string;
  model?: string;
  verbose?: boolean;
  autoRun?: string;
}

export function App({ apiKey, model, autoRun }: AppProps) {
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const memTimer = setInterval(() => {
      eventbus.emitStatusUpdate({
        memoryUsage: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        uptime: Date.now() - startTimeRef.current,
      });
    }, 5000);

    if (autoRun) {
      setInitialMessages([{
        id: `auto-${Date.now()}`, role: 'user', content: autoRun, timestamp: Date.now(),
      }]);
    }

    return () => { clearInterval(memTimer); eventbus.reset(); };
  }, []);

  return (
    <Box flexDirection="column" width="100%">
      <ChatView
        initialMessages={initialMessages}
        apiKey={apiKey}
        model={model}
      />
      <StatusBar />
    </Box>
  );
}
