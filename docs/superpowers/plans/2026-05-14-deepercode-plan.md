# DeeperCode 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建完整的 DeeperCode CLI 工具——基于 DeepSeek-V4-Pro 的终端 AI Agentic 编程助手，包含 105 个内置工具、Agent 系统、Skills 引擎、MCP 客户端和 Ink/React 终端 UI。

**Architecture:** 采用模块化分层架构：core（基础层）→ model/tools/mcp/skills（能力层）→ context/agent（编排层）→ ui/cli（交互层）。Agent 系统采用树形委派模式，主 Agent 可动态 fork 子 Agent。Ink+React 驱动现代化终端 REPL 界面。

**Tech Stack:** TypeScript 5.x, Node.js 20+, Ink 5, React 18, tsup, Vitest, pnpm, @modelcontextprotocol/sdk, isolated-vm, eventsource-parser, tree-sitter

---

## Phase 1: 项目脚手架 & 核心基础设施

### Task 1: 初始化项目结构

**Files:**
- Create: `e:\deeper-code\package.json`
- Create: `e:\deeper-code\tsconfig.json`
- Create: `e:\deeper-code\tsconfig.build.json`
- Create: `e:\deeper-code\.eslintrc.json`
- Create: `e:\deeper-code\.prettierrc`
- Create: `e:\deeper-code\vitest.config.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "deeper",
  "version": "1.0.0",
  "description": "DeeperCode - AI Agentic Coding CLI powered by DeepSeek V4 Pro",
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "deeper": "./dist/cli/index.js"
  },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^5.0.0",
    "ink-markdown": "^3.0.0",
    "ink-gradient": "^3.0.0",
    "ink-select-input": "^7.0.0",
    "ink-text-input": "^6.0.0",
    "ink-spinner": "^5.0.0",
    "ink-use-stdout-dimensions": "^2.0.0",
    "react": "^18.3.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "marked": "^14.0.0",
    "highlight.js": "^11.10.0",
    "eventsource-parser": "^3.0.0",
    "tree-sitter": "^0.22.0",
    "tree-sitter-javascript": "^0.23.0",
    "tree-sitter-typescript": "^0.23.0",
    "tree-sitter-python": "^0.23.0",
    "chokidar": "^4.0.0",
    "commander": "^13.0.0",
    "js-yaml": "^4.1.0",
    "diff": "^7.0.0",
    "strip-ansi": "^7.1.0",
    "fuse.js": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/diff": "^7.0.0",
    "@types/js-yaml": "^4.0.0",
    "typescript": "^5.7.0",
    "tsup": "^8.3.0",
    "vitest": "^3.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "prettier": "^3.4.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建 tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "declarationMap": false
  },
  "exclude": ["node_modules", "dist", "tests", "**/*.test.ts", "**/*.test.tsx"]
}
```

- [ ] **Step 4: 创建 .eslintrc.json**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "env": {
    "node": true,
    "es2022": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "no-console": "warn"
  }
}
```

- [ ] **Step 5: 创建 .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 6: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    },
  },
});
```

- [ ] **Step 7: 创建 tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  splitting: false,
  sourcemap: true,
});
```

- [ ] **Step 8: 安装依赖**

```bash
cd e:\deeper-code && pnpm install
```

- [ ] **Step 9: 提交**

```bash
git add .
git commit -m "chore: initialize project scaffolding with configs"
```

---

### Task 2: 核心常量与类型

**Files:**
- Create: `e:\deeper-code\src\core\constants.ts`
- Create: `e:\deeper-code\src\core\types.ts`

- [ ] **Step 1: 编写 constants.ts**

```typescript
export const DEEPER_VERSION = '1.0.0';

export const DEFAULT_MODEL = 'deepseek-v4-pro';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 100000;
export const DEFAULT_THINK_BUDGET = 32000;

export const DEFAULT_MAX_SUB_AGENTS = 5;
export const DEFAULT_MAX_RECURSION_DEPTH = 2;
export const DEFAULT_SUB_AGENT_TIMEOUT_MS = 120_000;
export const DEFAULT_AUTO_SUMMARIZE_THRESHOLD = 80_000;
export const DEFAULT_RESULT_SUMMARY_MAX_CHARS = 5_000;

export const CONFIG_DIR_NAME = '.deeper';
export const USER_CONFIG_PATH = '~/.deeper/config.json';
export const USER_MCP_PATH = '~/.deeper/mcp.json';
export const USER_SKILLS_DIR = '~/.deeper/skills';
export const MEMORY_FILE = 'memory.json';

export const DEEPER_ENV_PREFIX = 'DEEPER_';

export const TOOL_SAFETY_LEVELS = {
  SAFE: 'safe' as const,
  CONFIRM: 'confirm' as const,
  DANGEROUS: 'dangerous' as const,
};

export const SAFE_TOOLS = [
  'read_file', 'list_dir', 'grep_search', 'glob_find', 'file_info',
  'text_search', 'fuzzy_find', 'search_package', 'search_docs',
  'check_status', 'list_terminals', 'token_count', 'process_list',
  'system_info', 'log_viewer',
] as const;

export const DANGEROUS_TOOLS = [
  'delete_file', 'kill_terminal', 'db_backup', 'db_restore',
  'encrypt_file', 'decrypt_file',
] as const;
```

- [ ] **Step 2: 编写 types.ts**

```typescript
export type DeeperConfig = {
  model: {
    provider: 'deepseek';
    model: string;
    api_key: string;
    base_url: string;
    temperature: number;
    max_tokens: number;
    think: {
      enabled: boolean;
      budget: number;
    };
  };
  agent: {
    max_sub_agents: number;
    max_recursion_depth: number;
    sub_agent_timeout_ms: number;
    auto_approve_tools: string[];
    confirm_dangerous: string[];
    max_concurrent_tools: number;
  };
  context: {
    max_tokens: number;
    history_size: number;
    auto_summarize_threshold: number;
    file_context_limit: number;
  };
  ui: {
    theme: 'dark' | 'light';
    show_token_count: boolean;
    show_tool_calls: boolean;
    syntax_highlight: boolean;
    animation_speed: 'fast' | 'normal' | 'slow';
    compact_mode: boolean;
  };
  mcp: {
    servers: Record<string, MCPServerConfig>;
    auto_connect: boolean;
    connection_timeout_ms: number;
  };
  skills: {
    auto_load: boolean;
    discovery_paths: string[];
  };
  privacy: {
    telemetry: boolean;
    log_level: 'debug' | 'info' | 'warn' | 'error';
    max_log_files: number;
  };
};

export type MCPServerConfig = {
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

export type AgentState = 'CREATED' | 'THINKING' | 'EXECUTING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ToolCategory =
  | 'filesystem'
  | 'search'
  | 'shell'
  | 'network'
  | 'code'
  | 'database'
  | 'data'
  | 'security'
  | 'project'
  | 'ai'
  | 'system';

export type JSONSchemaProperty = {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  required?: boolean;
};

export type JSONSchema = {
  type: string;
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
};

export type ToolResult = {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type Tool = {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: JSONSchema;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
  dangerous?: boolean;
  requiresApproval?: boolean;
};

export type AgentMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type SkillManifest = {
  name: string;
  description: string;
  version: string;
  author: string;
  triggers: string[];
  tools: string[];
  dependencies: string[];
};
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd e:\deeper-code && pnpm typecheck
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add core constants and types"
```

---

### Task 3: 日志系统

**Files:**
- Create: `e:\deeper-code\src\core\logger.ts`
- Create: `e:\deeper-code\tests\unit\core\logger.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, Logger } from '../../../src/core/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger = createLogger({ level: 'debug' });
  });

  it('ควร log debug 消息เมื่อ level เป็น debug', () => {
    logger.debug('test debug');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('ควร log info 消息', () => {
    logger.info('test info');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('ควรไม่ log debug 消息เมื่อ level เป็น error', () => {
    const errorOnly = createLogger({ level: 'error' });
    errorOnly.debug('should not appear');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/logger.test.ts
```

- [ ] **Step 3: 实现 logger.ts**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(opts: { level?: LogLevel } = {}) {
  const levelKey: LogLevel = opts.level || 'info';
  const threshold = LOG_LEVEL_PRIORITY[levelKey];

  function format(level: string, msg: string, data?: unknown): string {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
    return data ? `${base} ${JSON.stringify(data)}` : base;
  }

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= threshold;
  }

  return {
    debug(msg: string, data?: unknown) {
      if (shouldLog('debug')) console.log(format('debug', msg, data));
    },
    info(msg: string, data?: unknown) {
      if (shouldLog('info')) console.log(format('info', msg, data));
    },
    warn(msg: string, data?: unknown) {
      if (shouldLog('warn')) console.warn(format('warn', msg, data));
    },
    error(msg: string, data?: unknown) {
      if (shouldLog('error')) console.error(format('error', msg, data));
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/logger.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add logger system"
```

---

### Task 4: 事件总线

**Files:**
- Create: `e:\deeper-code\src\core\eventbus.ts`
- Create: `e:\deeper-code\tests\unit\core\eventbus.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';

describe('EventBus', () => {
  it('ควร subscribe และ emit event ได้', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('ควรไม่เรียก handler หลังจาก off', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('ควร unsubscribe เมื่อใช้ returned function', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('test', handler);
    unsub();
    bus.emit('test', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('ควรรองรับ multiple handlers', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test', {});
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('ควรไม่ throw เมื่อ emit event ที่ไม่มี listener', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent', {})).not.toThrow();
  });

  it('ควร return false เมื่อ off event ที่ไม่มี listener', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const result = bus.off('test', handler);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/eventbus.test.ts
```

- [ ] **Step 3: 实现 eventbus.ts**

```typescript
type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => this.off(event, handler as EventHandler);
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): boolean {
    const handlers = this.handlers.get(event);
    if (!handlers) return false;
    handlers.delete(handler as EventHandler);
    if (handlers.size === 0) this.handlers.delete(event);
    return true;
  }

  emit<T = unknown>(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`[EventBus] Error handling event "${event}":`, e);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/eventbus.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add event bus"
```

---

### Task 5: 配置管理系统

**Files:**
- Create: `e:\deeper-code\src\core\config.ts`
- Create: `e:\deeper-code\tests\unit\core\config.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from '../../../src/core/config';
import { DeeperConfig } from '../../../src/core/types';
import { DEFAULT_MODEL } from '../../../src/core/constants';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  it('ควร return ค่าเริ่มต้นเมื่อไม่มี config', () => {
    const config = configManager.getAll();
    expect(config.model.model).toBe(DEFAULT_MODEL);
    expect(config.model.base_url).toBe('https://api.deepseek.com');
    expect(config.model.temperature).toBe(0.7);
  });

  it('ควร merge env variables', () => {
    vi.stubEnv('DEEPER_MODEL', 'deepseek-v4-flash');
    const config = configManager.getAll();
    expect(config.model.model).toBe('deepseek-v4-flash');
    vi.unstubAllEnvs();
  });

  it('ควร merge custom config โดย override', () => {
    configManager.merge({ model: { model: 'custom-model' } } as Partial<DeeperConfig>);
    expect(configManager.getAll().model.model).toBe('custom-model');
  });

  it('get ควร return ค่าเฉพาะ path', () => {
    expect(configManager.get('model.temperature')).toBe(0.7);
  });

  it('set ควร update ค่าที่ path ได้', () => {
    configManager.set('model.temperature', 0.2);
    expect(configManager.get('model.temperature')).toBe(0.2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/config.test.ts
```

- [ ] **Step 3: 实现 config.ts**

```typescript
import { DeeperConfig } from './types';
import {
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_THINK_BUDGET,
  DEFAULT_MAX_SUB_AGENTS,
  DEFAULT_MAX_RECURSION_DEPTH,
  DEFAULT_SUB_AGENT_TIMEOUT_MS,
  DEFAULT_AUTO_SUMMARIZE_THRESHOLD,
  DEEPER_ENV_PREFIX,
} from './constants';

function getDefaultConfig(): DeeperConfig {
  return {
    model: {
      provider: 'deepseek',
      model: DEFAULT_MODEL,
      api_key: '',
      base_url: DEFAULT_BASE_URL,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
      think: { enabled: true, budget: DEFAULT_THINK_BUDGET },
    },
    agent: {
      max_sub_agents: DEFAULT_MAX_SUB_AGENTS,
      max_recursion_depth: DEFAULT_MAX_RECURSION_DEPTH,
      sub_agent_timeout_ms: DEFAULT_SUB_AGENT_TIMEOUT_MS,
      auto_approve_tools: [],
      confirm_dangerous: [],
      max_concurrent_tools: 3,
    },
    context: {
      max_tokens: DEFAULT_MAX_TOKENS,
      history_size: 50,
      auto_summarize_threshold: DEFAULT_AUTO_SUMMARIZE_THRESHOLD,
      file_context_limit: 50000,
    },
    ui: {
      theme: 'dark',
      show_token_count: true,
      show_tool_calls: true,
      syntax_highlight: true,
      animation_speed: 'fast',
      compact_mode: false,
    },
    mcp: {
      servers: {},
      auto_connect: true,
      connection_timeout_ms: 10000,
    },
    skills: {
      auto_load: true,
      discovery_paths: ['~/.deeper/skills', '.deeper/skills'],
    },
    privacy: {
      telemetry: false,
      log_level: 'info',
      max_log_files: 10,
    },
  };
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(
        (target[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>,
      );
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function readEnvConfig(): Partial<DeeperConfig> {
  const env: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(DEEPER_ENV_PREFIX) || !value) continue;
    const configKey = key.slice(DEEPER_ENV_PREFIX.length).toLowerCase();
    const keys = configKey.split('_');
    let current: Record<string, unknown> = env;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }
  return env as unknown as Partial<DeeperConfig>;
}

export class ConfigManager {
  private config: DeeperConfig;

  constructor(initial?: Partial<DeeperConfig>) {
    this.config = getDefaultConfig();
    const envConfig = readEnvConfig();
    this.config = deepMerge(this.config, envConfig as Record<string, unknown>) as DeeperConfig;
    if (initial) {
      this.merge(initial);
    }
  }

  merge(partial: Partial<DeeperConfig>): void {
    this.config = deepMerge(this.config as Record<string, unknown>, partial as Record<string, unknown>) as DeeperConfig;
  }

  getAll(): DeeperConfig {
    return { ...this.config };
  }

  get(path: string): unknown {
    const keys = path.split('.');
    let current: unknown = this.config;
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  set(path: string, value: unknown): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/config.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add config manager"
```

---

### Task 6: 存储系统

**Files:**
- Create: `e:\deeper-code\src\core\storage.ts`
- Create: `e:\deeper-code\tests\unit\core\storage.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { os } from 'os';
import { StorageManager } from '../../../src/core/storage';

describe('StorageManager', () => {
  const testDir = join(os.tmpdir(), 'deeper-test-storage-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('ควร save และ load ข้อมูลได้', () => {
    const storage = new StorageManager(testDir);
    const data = { name: 'test', value: 123 };
    storage.save('test.json', data);
    const loaded = storage.load<typeof data>('test.json');
    expect(loaded).toEqual(data);
  });

  it('ควร return default เมื่อ file ไม่มี', () => {
    const storage = new StorageManager(testDir);
    const result = storage.load('nonexistent.json', { default: true });
    expect(result).toEqual({ default: true });
  });

  it('ควร delete ไฟล์ได้', () => {
    const storage = new StorageManager(testDir);
    storage.save('temp.json', { a: 1 });
    expect(storage.exists('temp.json')).toBe(true);
    storage.delete('temp.json');
    expect(storage.exists('temp.json')).toBe(false);
  });

  it('exists ควร return false สำหรับไฟล์ที่ไม่มี', () => {
    const storage = new StorageManager(testDir);
    expect(storage.exists('nope.json')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/storage.test.ts
```

- [ ] **Step 3: 实现 storage.ts**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

export class StorageManager {
  constructor(private baseDir: string) {
    mkdirSync(baseDir, { recursive: true });
  }

  save<T = unknown>(filename: string, data: T): void {
    const filePath = join(this.baseDir, filename);
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  load<T = unknown>(filename: string, defaultValue?: T): T {
    const filePath = join(this.baseDir, filename);
    if (!existsSync(filePath)) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`File not found: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  exists(filename: string): boolean {
    return existsSync(join(this.baseDir, filename));
  }

  delete(filename: string): void {
    const filePath = join(this.baseDir, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/storage.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add storage manager"
```

---

### Task 7: 进程管理工具

**Files:**
- Create: `e:\deeper-code\src\core\process.ts`

- [ ] **Step 1: 实现 process.ts**

```typescript
import { exec, execSync, ChildProcess, spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export type CommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  killed: boolean;
};

export type RunningProcess = {
  id: string;
  process: ChildProcess;
  startTime: number;
};

export class ProcessManager {
  private processes = new Map<string, RunningProcess>();
  private idCounter = 0;

  async run(command: string, cwd?: string, timeoutMs?: number): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
      });
      return { stdout, stderr, code: 0, killed: false };
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || (e as Error).message || '',
        code: err.code ?? 1,
        killed: err.killed ?? false,
      };
    }
  }

  spawn(command: string, args: string[], options?: SpawnOptions): string {
    const id = `proc_${++this.idCounter}`;
    const child = spawn(command, args, {
      ...options,
      stdio: options?.stdio || 'pipe',
    });
    this.processes.set(id, { id, process: child, startTime: Date.now() });
    return id;
  }

  getProcess(id: string): RunningProcess | undefined {
    return this.processes.get(id);
  }

  async kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    const proc = this.processes.get(id);
    if (!proc) return;
    if (proc.process.exitCode === null && proc.process.signalCode === null) {
      proc.process.kill(signal);
    }
    this.processes.delete(id);
  }

  list(): RunningProcess[] {
    return Array.from(this.processes.values());
  }

  cleanup(): void {
    for (const [id, proc] of this.processes) {
      if (proc.process.exitCode === null && proc.process.signalCode === null) {
        proc.process.kill('SIGTERM');
      }
      this.processes.delete(id);
    }
  }
}

export const processManager = new ProcessManager();
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: add process manager"
```

---

### Task 8: 加密工具与沙箱

**Files:**
- Create: `e:\deeper-code\src\core\crypto.ts`
- Create: `e:\deeper-code\src\core\sandbox.ts`
- Create: `e:\deeper-code\tests\unit\core\crypto.test.ts`

- [ ] **Step 1: 实现 crypto.ts**

```typescript
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function hash(content: string, algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'): string {
  return createHash(algorithm).update(content).digest('hex');
}

export function generateId(length = 8): string {
  return randomBytes(length).toString('hex').slice(0, length * 2);
}

export function encrypt(text: string, key: string): { encrypted: string; iv: string; authTag: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipherKey = createHash('sha256').update(key).digest();
  const cipher = createCipheriv(ALGORITHM, cipherKey, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), authTag };
}

export function decrypt(encrypted: string, key: string, ivHex: string, authTagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipherKey = createHash('sha256').update(key).digest();
  const decipher = createDecipheriv(ALGORITHM, cipherKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
```

- [ ] **Step 2: 实现 sandbox.ts**

```typescript
import ivm from 'isolated-vm';

export type SandboxOptions = {
  timeoutMs?: number;
  memoryLimitMb?: number;
};

export async function runInSandbox(code: string, context: Record<string, unknown> = {}, options: SandboxOptions = {}): Promise<unknown> {
  const isolate = new ivm.Isolate({ memoryLimit: (options.memoryLimitMb || 128) * 1024 * 1024 });
  const isolateContext = await isolate.createContext();
  const jail = isolateContext.global;
  await jail.set('global', jail.derefInto());

  for (const [key, value] of Object.entries(context)) {
    await jail.set(key, value, { copy: true });
  }

  const script = await isolate.compileScript(code);
  const result = await script.run(isolateContext, {
    timeout: options.timeoutMs || 5000,
  });

  isolate.dispose();
  return result;
}
```

- [ ] **Step 3: 编写并运行测试**

```typescript
import { describe, it, expect } from 'vitest';
import { hash, generateId, encrypt, decrypt } from '../../../src/core/crypto';

describe('crypto', () => {
  it('hash ควร return sha256', () => {
    const result = hash('hello');
    expect(result).toHaveLength(64);
    expect(typeof result).toBe('string');
  });

  it('generateId ควร return id ที่มีความยาวถูกต้อง', () => {
    const id = generateId(8);
    expect(id).toHaveLength(16);
  });

  it('encrypt และ decrypt ควรทำงานได้ครบวงจร', () => {
    const { encrypted, iv, authTag } = encrypt('secret message', 'my-key');
    const decrypted = decrypt(encrypted, 'my-key', iv, authTag);
    expect(decrypted).toBe('secret message');
  });
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd e:\deeper-code && pnpm test -- tests/unit/core/crypto.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add crypto utilities and sandbox"
```

---

## Phase 2: DeepSeek 模型客户端

### Task 9: 模型层类型定义

**Files:**
- Create: `e:\deeper-code\src\model\types.ts`

- [ ] **Step 1: 实现 types.ts**

```typescript
export type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type DeepSeekTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
};

export type DeepSeekRequest = {
  model: string;
  messages: DeepSeekMessage[];
  tools?: DeepSeekTool[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
};

export type DeepSeekChoice = {
  index: number;
  message: DeepSeekMessage;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
};

export type DeepSeekUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
