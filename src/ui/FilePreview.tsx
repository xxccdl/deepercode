import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';

interface FilePreviewProps {
  filePath: string;
  content?: string;
  language?: string;
  lineCount?: number;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    md: 'Markdown', html: 'HTML', css: 'CSS', scss: 'SCSS',
    sql: 'SQL', sh: 'Shell', bat: 'Batch', ps1: 'PowerShell',
  };
  return map[ext || ''] || ext?.toUpperCase() || 'text';
}

export function FilePreview({ filePath, content, language, lineCount, size }: FilePreviewProps) {
  const lang = language || detectLang(filePath);
  const lines = content ? content.split('\n').slice(0, 10) : [];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={defaultTheme.border} paddingX={1}>
      <Box>
        <Text bold>📄 </Text>
        <Text bold color={defaultTheme.primary}>{filePath}</Text>
        <Text dimColor> ({lang})</Text>
        {size !== undefined ? <Text dimColor> - {formatSize(size)}</Text> : null}
        {lineCount !== undefined ? <Text dimColor> - {lineCount} 行</Text> : null}
      </Box>

      {content ? (
        <Box flexDirection="column" borderStyle="single" borderColor={defaultTheme.border} paddingX={1} marginTop={0}>
          {lines.map((line, i) => (
            <Box key={i}>
              <Text dimColor>{(i + 1).toString().padStart(3, ' ')} │ </Text>
              <Text>{line.length > 100 ? line.slice(0, 100) + '...' : line}</Text>
            </Box>
          ))}
          {content.split('\n').length > 10 ? (
            <Text dimColor>... 还有 {content.split('\n').length - 10} 行</Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
