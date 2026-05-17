import { useMemo } from 'react';
import { Text, Box } from 'ink';
import { diffLines } from 'diff';
import { defaultTheme } from './themes/default.ts';

interface DiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
}

export function DiffView({ filePath, oldContent, newContent }: DiffViewProps) {
  const changes = useMemo(() => {
    return diffLines(oldContent || '', newContent || '', {
      ignoreWhitespace: false,
    });
  }, [oldContent, newContent]);

  const addedCount = changes.filter((c) => c.added).length;
  const removedCount = changes.filter((c) => c.removed).length;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={defaultTheme.border} paddingX={1}>
      <Box>
        <Text bold>📄 </Text>
        <Text bold color={defaultTheme.primary}>{filePath}</Text>
        <Text dimColor>
          {' '}
          <Text color={defaultTheme.success}>+{addedCount}</Text>
          {' / '}
          <Text color={defaultTheme.error}>-{removedCount}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={0}>
        {changes.slice(0, 50).map((change, i) => {
          if (change.added) {
            return (
              <Box key={i}>
                <Text color={defaultTheme.success}>+ {change.value.trimEnd()}</Text>
              </Box>
            );
          }
          if (change.removed) {
            return (
              <Box key={i}>
                <Text color={defaultTheme.error}>- {change.value.trimEnd()}</Text>
              </Box>
            );
          }
          return (
            <Box key={i}>
              <Text dimColor>  {change.value.trimEnd()}</Text>
            </Box>
          );
        })}
      </Box>

      {changes.length > 50 ? (
        <Text dimColor>... 还有 {changes.length - 50} 处变更未显示</Text>
      ) : null}
    </Box>
  );
}
