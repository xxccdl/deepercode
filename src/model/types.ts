import type { ToolCall, ToolDefinition } from '../tools/tool-types.js';

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
  thinking?: string;
  timestamp?: number;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_call_start' | 'tool_call_end' | 'tool_call' | 'done' | 'error';
  content?: string;
  tool_call?: ToolCall | { id: string; name: string; index?: number };
  error?: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  think: {
    enabled: boolean;
    budgetTokens: number;
  };
  signal?: AbortSignal;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  task: string;
  children?: AgentInfo[];
}

export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: '显示帮助信息' },
  { command: '/clear', description: '清空对话' },
  { command: '/quit', description: '退出 DeeperCode' },
  { command: '/save [name]', description: '保存当前会话' },
  { command: '/load [name]', description: '加载历史会话' },
  { command: '/resume [name]', description: '恢复历史会话' },
  { command: '/sessions', description: '会话列表' },
  { command: '/model', description: '查看/切换模型' },
  { command: '/config', description: '查看/修改配置' },
  { command: '/tools [cat]', description: '列出可用工具' },
  { command: '/skills', description: '列出已加载技能' },
  { command: '/mcp', description: '管理 MCP 连接' },
  { command: '/memory', description: '记忆系统' },
  { command: '/tasks', description: '任务列表' },
  { command: '/rules', description: '规则管理' },
  { command: '/stats', description: '统计信息' },
  { command: '/status', description: '当前状态' },
  { command: '/cwd', description: '当前目录' },
  { command: '/export', description: '导出对话' },
  { command: '/init', description: '初始化项目' },
  { command: '/plan <任务>', description: '先出方案再实施' },
  { command: '/spec <任务>', description: '先出规格再实施' },
  { command: '/review <路径>', description: '代码审查' },
  { command: '/fix [目标]', description: '自动修复构建/测试错误' },
  { command: '/commit', description: '智能分析变更并提交' },
  { command: '/analyze [路径]', description: '项目架构分析' },
  { command: '/diff <文件>', description: '查看文件变更' },
  { command: '/undo', description: '撤销最近文件修改' },
];

export type DeepSeekMessage = ChatMessage;
export type DeepSeekToolCall = ToolCall;
export type DeepSeekToolDefinition = ToolDefinition;
export type DeepSeekRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: DeepSeekToolDefinition[];
};
export type DeepSeekResponse = {
  id: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
};
export type DeepSeekStreamChunk = StreamChunk;
