import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export const DEEPER_VERSION = '1.7.1';
export const DEEPER_NAME = 'DeeperCode';
export const DEEPER_HOME = join(process.env.DEEPER_HOME || join(homedir(), '.deeper'));
export const DEEPER_CONFIG_FILE = join(DEEPER_HOME, 'config.json');
export const DEEPER_MCP_FILE = join(DEEPER_HOME, 'mcp.json');
export const DEEPER_SKILLS_DIR = join(DEEPER_HOME, 'skills');
export const DEEPER_SESSIONS_DIR = join(DEEPER_HOME, 'sessions');
export const DEEPER_LOGS_DIR = join(DEEPER_HOME, 'logs');
export const DEEPER_MEMORY_FILE = join(DEEPER_HOME, 'memory.json');
export const PROJECT_CONFIG_DIR = '.deeper';
export const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, 'config.json');
export const PROJECT_SKILLS_DIR = join(PROJECT_CONFIG_DIR, 'skills');

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-pro';

export const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn';

export interface ModelEntry {
  id: string;
  name: string;
  provider: 'deepseek' | 'siliconflow';
  baseUrl: string;
  description: string;
}

export const ALL_MODELS: ModelEntry[] = [
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', baseUrl: DEEPSEEK_BASE_URL, description: '旗舰 MoE 1.6T · 1M 上下文 · 编程+推理' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', baseUrl: DEEPSEEK_BASE_URL, description: '284B · 极速轻量' },

  { id: 'deepseek-ai/DeepSeek-V4-Pro', name: 'DeepSeek V4 Pro (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '旗舰 1600B · 1M 上下文' },
  { id: 'deepseek-ai/DeepSeek-V4-Flash', name: 'DeepSeek V4 Flash (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '284B · 极速轻量' },
  { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '671B · IMO金牌·编程标杆' },
  { id: 'Pro/deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2 Pro (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '671B · 增强推理' },
  { id: 'deepseek-ai/DeepSeek-V3.1-Terminus', name: 'DeepSeek V3.1 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '671B · 稳定Agent' },
  { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '671B · 推理专用' },

  { id: 'Pro/zai-org/GLM-5.1', name: 'GLM-5.1 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '智谱 754B · Vibe Coding旗舰' },
  { id: 'Pro/zai-org/GLM-5', name: 'GLM-5 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '智谱 744B · 系统工程' },
  { id: 'Pro/zai-org/GLM-4.7', name: 'GLM-4.7 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '智谱 355B · 交错思考' },
  { id: 'zai-org/GLM-4.5-Air', name: 'GLM-4.5-Air (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '智谱 106B MoE · 高性价比' },

  { id: 'Pro/moonshotai/Kimi-K2.6', name: 'Kimi K2.6 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '月之暗面 1T · 多模态Agent' },
  { id: 'Pro/moonshotai/Kimi-K2.5', name: 'Kimi K2.5 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '月之暗面 1T · 视觉+编码' },

  { id: 'nex-agi/Nex-N2-Pro', name: 'Nex-N2-Pro (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '397B · 自适应推理·SOTA' },
  { id: 'MiniMaxAI/MiniMax-M2.5', name: 'MiniMax M2.5 (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '229B · 编程+搜索' },

  { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3 235B (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '通义 235B MoE · 通用强' },
  { id: 'Qwen/Qwen3-30B-A3B', name: 'Qwen3 30B (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '通义 30B MoE · 轻量高效' },
  { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen Coder 32B (SF)', provider: 'siliconflow', baseUrl: SILICONFLOW_BASE_URL, description: '通义 · 编程专精' },
];

export function getModelProvider(modelId: string): ModelEntry | undefined {
  return ALL_MODELS.find(m => m.id === modelId);
}

export function getModelBaseUrl(modelId: string): string {
  const entry = ALL_MODELS.find(m => m.id === modelId);
  if (entry) return entry.baseUrl;
  if (modelId.includes('/')) return SILICONFLOW_BASE_URL;
  return DEEPSEEK_BASE_URL;
}

export function getDefaultBaseUrl(modelId?: string): string {
  if (modelId) return getModelBaseUrl(modelId);
  return DEEPSEEK_BASE_URL;
}

export const DEEPSEEK_MAX_TOKENS = 1_048_576;
export const DEEPSEEK_THINK_BUDGET = 16000;

export const AGENT_MAX_SUB_AGENTS = 5;
export const AGENT_MAX_RECURSION_DEPTH = 2;
export const AGENT_SUB_AGENT_TIMEOUT_MS = 120000;
export const AGENT_MAX_CONCURRENT_TOOLS = 3;

export const CONTEXT_MAX_TOKENS = 1_048_576;
export const CONTEXT_AUTO_SUMMARIZE_THRESHOLD = 786_432;
export const CONTEXT_HISTORY_SIZE = 80;
export const CONTEXT_FILE_LIMIT = 50_000;

export const CONTEXT_COMPRESSION_STAGES = [
  { threshold: 0.7, strategy: 'light' },
  { threshold: 0.85, strategy: 'aggressive' },
  { threshold: 0.95, strategy: 'emergency' },
] as const;

export const MCP_CONNECTION_TIMEOUT_MS = 120000;

export const TOOL_CATEGORIES = [
  'filesystem', 'search', 'shell', 'network',
  'code', 'database', 'data', 'security',
  'project', 'ai', 'system',
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number];
