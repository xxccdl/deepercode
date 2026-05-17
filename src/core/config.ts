import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { DEEPER_CONFIG_FILE, PROJECT_CONFIG_FILE, DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_BASE_URL } from './constants.js';

export interface MCPConfigEntry {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  autoConnect: boolean;
}

export interface SkillConfigEntry {
  name: string;
  path: string;
  enabled: boolean;
  autoLoad: boolean;
}

export interface DeeperConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  thinkEnabled: boolean;
  thinkBudget: number;
  thinkBudgetTokens: number;
  logLevel: string;
  maxRetries: number;
  timeoutMs: number;
  maxSubAgents: number;
  maxRecursionDepth: number;
  theme: 'dark' | 'light';
  locale: string;
  mcpServers: MCPConfigEntry[];
  skills: SkillConfigEntry[];
  [key: string]: unknown;
}

const DEFAULT_CONFIG: DeeperConfig = {
  model: DEEPSEEK_DEFAULT_MODEL,
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseUrl: DEEPSEEK_BASE_URL,
  temperature: 0.7,
  maxTokens: 8192,
  thinkEnabled: true,
  thinkBudget: 32000,
  thinkBudgetTokens: 32000,
  logLevel: 'info',
  maxRetries: 3,
  timeoutMs: 120000,
  maxSubAgents: 5,
  maxRecursionDepth: 2,
  theme: 'dark',
  locale: 'zh-CN',
  mcpServers: [],
  skills: [],
};

const PROJECT_CONFIG_PATH = join(process.cwd(), PROJECT_CONFIG_FILE);
const USER_CONFIG_PATH = DEEPER_CONFIG_FILE;

export class ConfigManager {
  private defaults: DeeperConfig;
  private userConfig: Partial<DeeperConfig>;
  private projectConfig: Partial<DeeperConfig>;
  private envOverrides: Partial<DeeperConfig>;
  private cliOverrides: Partial<DeeperConfig>;

  constructor() {
    this.defaults = { ...DEFAULT_CONFIG };
    this.userConfig = {};
    this.projectConfig = {};
    this.envOverrides = {};
    this.cliOverrides = {};
  }

  load(): void {
    this.userConfig = this.readJSONFile(USER_CONFIG_PATH);
    this.projectConfig = this.readJSONFile(PROJECT_CONFIG_PATH);
    this.envOverrides = this.readEnvOverrides();
  }

  save(scope: 'user' | 'project'): void {
    const configPath = scope === 'user' ? USER_CONFIG_PATH : PROJECT_CONFIG_PATH;
    const currentConfig = scope === 'user' ? this.userConfig : this.projectConfig;
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
  }

  get<K extends keyof DeeperConfig>(key: K): DeeperConfig[K] {
    if (key in this.cliOverrides) {
      return this.cliOverrides[key] as DeeperConfig[K];
    }
    if (key in this.envOverrides) {
      return this.envOverrides[key] as DeeperConfig[K];
    }
    if (key in this.projectConfig) {
      return this.projectConfig[key] as DeeperConfig[K];
    }
    if (key in this.userConfig) {
      return this.userConfig[key] as DeeperConfig[K];
    }
    return this.defaults[key];
  }

  set<K extends keyof DeeperConfig>(key: K, value: DeeperConfig[K], scope: 'cli' | 'project' | 'user'): void {
    switch (scope) {
      case 'cli':
        this.cliOverrides[key] = value;
        break;
      case 'project':
        this.projectConfig[key] = value;
        break;
      case 'user':
        this.userConfig[key] = value;
        break;
    }
  }

  setCliOverrides(overrides: Partial<DeeperConfig>): void {
    this.cliOverrides = { ...overrides };
  }

  getAll(): DeeperConfig {
    return {
      ...this.defaults,
      ...this.userConfig,
      ...this.projectConfig,
      ...this.envOverrides,
      ...this.cliOverrides,
    };
  }

  private readJSONFile(path: string): Partial<DeeperConfig> {
    try {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content) as Partial<DeeperConfig>;
      }
    } catch {
    }
    return {};
  }

  private readEnvOverrides(): Partial<DeeperConfig> {
    const overrides: Partial<DeeperConfig> = {};
    const envMap: Record<string, keyof DeeperConfig> = {
      DEEPER_MODEL: 'model',
      DEEPER_API_KEY: 'apiKey',
      DEEPER_BASE_URL: 'baseUrl',
      DEEPER_TEMPERATURE: 'temperature',
      DEEPER_MAX_TOKENS: 'maxTokens',
      DEEPER_THINK_ENABLED: 'thinkEnabled',
      DEEPER_THINK_BUDGET: 'thinkBudget',
      DEEPER_LOG_LEVEL: 'logLevel',
      DEEPER_MAX_RETRIES: 'maxRetries',
      DEEPER_TIMEOUT: 'timeoutMs',
    };

    for (const [envKey, configKey] of Object.entries(envMap)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        switch (typeof DEFAULT_CONFIG[configKey]) {
          case 'number':
            (overrides as Record<string, unknown>)[configKey] = Number(value);
            break;
          case 'boolean':
            (overrides as Record<string, unknown>)[configKey] = value.toLowerCase() === 'true' || value === '1';
            break;
          default:
            (overrides as Record<string, unknown>)[configKey] = value;
            break;
        }
      }
    }

    return overrides;
  }
}

let cachedConfig: DeeperConfig | null = null;

const KEY_ALIASES: Record<string, keyof DeeperConfig> = {
  api_key: 'apiKey',
  'api-key': 'apiKey',
  base_url: 'baseUrl',
  'base-url': 'baseUrl',
  max_tokens: 'maxTokens',
  'max-tokens': 'maxTokens',
  think_enabled: 'thinkEnabled',
  'think-enabled': 'thinkEnabled',
  think_budget: 'thinkBudget',
  'think-budget': 'thinkBudget',
  log_level: 'logLevel',
  'log-level': 'logLevel',
  max_retries: 'maxRetries',
  'max-retries': 'maxRetries',
  timeout_ms: 'timeoutMs',
  'timeout-ms': 'timeoutMs',
  max_sub_agents: 'maxSubAgents',
  'max-sub-agents': 'maxSubAgents',
  max_recursion_depth: 'maxRecursionDepth',
  'max-recursion-depth': 'maxRecursionDepth',
  mcp_servers: 'mcpServers',
  'mcp-servers': 'mcpServers',
};

function normalizeConfig(raw: Record<string, unknown>): Partial<DeeperConfig> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = KEY_ALIASES[key] || key;
    result[canonical] = value;
  }
  return result as Partial<DeeperConfig>;
}

export function loadConfig(): DeeperConfig {
  if (cachedConfig) return cachedConfig;
  try {
    if (existsSync(DEEPER_CONFIG_FILE)) {
      const raw = readFileSync(DEEPER_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      cachedConfig = { ...DEFAULT_CONFIG, ...normalizeConfig(parsed) };
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  return cachedConfig;
}

export function saveConfig(config?: DeeperConfig): void {
  if (config) cachedConfig = { ...config };
  if (!cachedConfig) cachedConfig = { ...DEFAULT_CONFIG };
  const dir = dirname(DEEPER_CONFIG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DEEPER_CONFIG_FILE, JSON.stringify(cachedConfig, null, 2), 'utf-8');
}

export function getConfig(): DeeperConfig {
  return cachedConfig ?? loadConfig();
}

export function updateConfig(partial: Partial<DeeperConfig>): DeeperConfig {
  const current = getConfig();
  cachedConfig = { ...current, ...partial };
  saveConfig();
  return cachedConfig;
}

export function resetConfig(): DeeperConfig {
  cachedConfig = { ...DEFAULT_CONFIG };
  saveConfig();
  return cachedConfig;
}

export function getConfigValue<K extends keyof DeeperConfig>(key: K): DeeperConfig[K] {
  return getConfig()[key];
}

export function setConfigValue<K extends keyof DeeperConfig>(key: K, value: DeeperConfig[K]): void {
  updateConfig({ [key]: value } as unknown as Partial<DeeperConfig>);
}

export function getApiKey(): string {
  return getConfig().apiKey || process.env.DEEPSEEK_API_KEY || '';
}

export function getModel(): string {
  return getConfig().model;
}

export function getBaseUrl(): string {
  return getConfig().baseUrl;
}

export const configManager = { load: () => loadConfig(), save: saveConfig, get: getConfigValue, set: setConfigValue, getAll: getConfig };
