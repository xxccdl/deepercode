import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';

interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

const statusConfig: Record<ToolCallCardProps['status'], { icon: string; color: string; label: string }> = {
  pending: { icon: '⏳', color: defaultTheme.dimText, label: '等待中' },
  running: { icon: '🔄', color: defaultTheme.primary, label: '执行中' },
  completed: { icon: '✅', color: defaultTheme.success, label: '已完成' },
  failed: { icon: '❌', color: defaultTheme.error, label: '失败' },
};

function summarizeArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '无参数';

  const maxLen = 60;
  const summary = entries
    .map(([k, v]) => {
      const strVal = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${strVal.length > 40 ? strVal.slice(0, 40) + '...' : strVal}`;
    })
    .join(', ');

  return summary.length > maxLen ? summary.slice(0, maxLen) + '...' : summary;
}

export function ToolCallCard({ toolName, args, result, status }: ToolCallCardProps) {
  const cfg = statusConfig[status];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={cfg.color}
      paddingX={1}
      marginY={0}
    >
      <Box>
        <Text color={cfg.color}>{cfg.icon}</Text>
        <Text bold color={cfg.color}> {toolName}</Text>
        <Text dimColor> - {cfg.label}</Text>
      </Box>

      <Box marginTop={0}>
        <Text dimColor>参数: </Text>
        <Text>{summarizeArgs(args)}</Text>
      </Box>

      {result && status === 'completed' ? (
        <Box marginTop={0} flexDirection="column">
          <Text dimColor>结果: </Text>
          <Box borderStyle="single" borderColor={defaultTheme.border} paddingX={1}>
            <Text>
              {result.length > 200 ? result.slice(0, 200) + '...' : result}
            </Text>
          </Box>
        </Box>
      ) : null}

      {result && status === 'failed' ? (
        <Box marginTop={0}>
          <Text color={defaultTheme.error}>错误: {result}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
