import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';

interface AgentNode {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  children?: AgentNode[];
}

interface AgentTreeProps {
  agents: AgentNode[];
}

const statusIcon: Record<AgentNode['status'], string> = {
  idle: '⏸',
  running: '🔄',
  completed: '✅',
  failed: '❌',
};

const statusColor: Record<AgentNode['status'], string> = {
  idle: defaultTheme.dimText,
  running: defaultTheme.primary,
  completed: defaultTheme.success,
  failed: defaultTheme.error,
};

function AgentNodeRow({
  node,
  depth,
  isLast,
}: {
  node: AgentNode;
  depth: number;
  isLast: boolean;
}) {
  const prefix = depth === 0
    ? ''
    : '  '.repeat(depth - 1) + (isLast ? '└─' : '├─');

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{prefix}</Text>
        <Text color={statusColor[node.status]}>{statusIcon[node.status]}</Text>
        <Text bold color={statusColor[node.status]}> {node.name}</Text>
      </Box>
      {node.children?.map((child, i) => (
        <AgentNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          isLast={i === (node.children?.length || 0) - 1}
        />
      ))}
    </Box>
  );
}

export function AgentTree({ agents }: AgentTreeProps) {
  const total = agents.length;
  const running = agents.filter((a) => a.status === 'running').length;
  const completed = agents.filter((a) => a.status === 'completed').length;
  const failed = agents.filter((a) => a.status === 'failed').length;

  const countChildren = (ns: AgentNode[]): number =>
    ns.reduce((sum, n) => sum + 1 + countChildren(n.children || []), 0);

  const totalWithChildren = countChildren(agents);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={defaultTheme.border} paddingX={1}>
      <Box>
        <Text bold>🤖 Agent 树</Text>
        <Text dimColor>
          {' '}
          [{totalWithChildren} 节点:
          {' '}<Text color={defaultTheme.success}>{completed} 完成</Text>
          {running > 0 ? <Text color={defaultTheme.primary}> {running} 运行</Text> : null}
          {failed > 0 ? <Text color={defaultTheme.error}> {failed} 失败</Text> : null}
          ]
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={0}>
        {agents.map((agent, i) => (
          <AgentNodeRow
            key={agent.id}
            node={agent}
            depth={0}
            isLast={i === total - 1}
          />
        ))}
      </Box>
    </Box>
  );
}
