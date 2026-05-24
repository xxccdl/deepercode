import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export const DEEPER_VERSION = '1.3.23';
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
export const DEEPSEEK_MODELS = ['deepseek-v4-pro', 'deepseek-v4-flash'] as const;
export type DeepSeekModel = typeof DEEPSEEK_MODELS[number];
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

export const MCP_CONNECTION_TIMEOUT_MS = 10000;

export const TOOL_CATEGORIES = [
  'filesystem', 'search', 'shell', 'network',
  'code', 'database', 'data', 'security',
  'project', 'ai', 'system',
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number];
