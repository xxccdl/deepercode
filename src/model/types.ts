import type { ToolCall, ToolDefinition } from '../tools/tool-types.js';

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  toolCalls?: ToolCallRecord[];
  tool_call_id?: string;
  name?: string;
  thinking?: string;
  timestamp?: number;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_call' | 'done' | 'error';
  content?: string;
  tool_call?: ToolCall;
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
  { command: '/model', description: '查看/切换模型' },
  { command: '/config', description: '查看/修改配置' },
  { command: '/tools', description: '列出可用工具' },
  { command: '/skills', description: '列出已加载技能' },
  { command: '/mcp', description: '管理 MCP 连接' },
  { command: '/save', description: '保存当前会话' },
  { command: '/load', description: '加载历史会话' },
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
