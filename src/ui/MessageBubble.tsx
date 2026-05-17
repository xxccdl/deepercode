import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';

interface Props {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  thinking?: string;
  timestamp?: number;
}

export function MessageBubble({ role, content }: Props) {
  const display = content ?? '';
  const lines = display.split('\n');
  const color = role === 'user' ? defaultTheme.secondary : defaultTheme.text;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={role === 'user' ? defaultTheme.secondary : defaultTheme.primary} bold>
          {role === 'user' ? '> ' : role === 'system' ? '⚙ ' : '● '}
        </Text>
      </Box>
      {lines.map((line, i) => (
        <Box key={i} paddingLeft={1}>
          <Text color={color}>{line || ' '}</Text>
        </Box>
      ))}
    </Box>
  );
}
