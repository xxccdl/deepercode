# DeeperCode 设计规格文档

> 版本：1.0.0 | 日期：2026-05-14 | 状态：待审阅

---

## 1. 项目概述

**DeeperCode** 是一款终端 CLI 类型的 Agentic 编程工具，目标定位为"中文世界最强大的 AI 编程助手"。基于 DeepSeek-V4-Pro 模型，提供现代化的交互式 REPL 界面、强大的 Agent 系统、混合型 Skills 引擎、完整 MCP 协议支持以及 105 个内置工具。

### 1.1 核心目标

- 一句话生成完整项目
- 现代化 CLI 式 UI（Ink/React 渲染）
- 强大的 Agent 系统（树形委派 + 单 Agent 模式）
- 混合型 Skills 引擎（AI 可自创建 Skill）
- 完整 MCP 客户端支持（stdio + SSE/HTTP）
- 105 个内置 AI 可用工具
- AI 可自定义工具

### 1.2 非目标（明确排除）

- 不提供 Git 内置工具（用户使用系统 Git）
- 不提供 GUI 界面（纯终端 CLI）
- 不提供多租户 SaaS 平台

---

## 2. 技术栈

| 层 | 技术 | 版本要求 |
|----|------|----------|
| 语言 | TypeScript | 5.x |
| 运行时 | Node.js | 20+ LTS |
| CLI 框架 | Ink + React | Ink 5, React 18 |
| 构建工具 | tsup | latest |
| 测试框架 | Vitest | latest |
| 包管理器 | pnpm | latest |
| Markdown 渲染 | ink-markdown + marked | latest |
| MCP SDK | @modelcontextprotocol/sdk | latest |
| AST 解析 | tree-sitter | latest |
| 沙箱执行 | isolated-vm | latest |
| SSE 解析 | eventsource-parser | latest |
| 代码检查 | ESLint + Prettier | latest |

---

## 3. AI 模型集成

### 3.1 模型配置

| 配置项 | 值 |
|--------|-----|
| Provider | DeepSeek |
| Model | `deepseek-v4-pro` |
| Base URL | `https://api.deepseek.com` |
| 上下文窗口 | 1,000,000 Token |
| 架构 | MoE 混合专家，万亿级参数 |
| 多模态 | 文本 + 图像 + 音视频 |
| API 兼容 | OpenAI ChatCompletions 接口 |

### 3.2 Think 模式

Think（思考推理）模式通过 API 参数控制，而非模型名后缀：

```json
{
  "model": "deepseek-v4-pro",
  "reasoning_effort": "high",
  "thinking": { "type": "enabled", "budget_tokens": 32000 }
}
```

### 3.3 流式处理

- 使用 SSE（Server-Sent Events）协议接收流式响应
- 支持 `thinking` 块解析（推理过程独立展示）
- 支持工具调用增量解析（streaming tool calls）

---

## 4. 项目工程结构

```
deeper-code/
├── src/
│   ├── cli/                    # CLI 入口层
│   │   ├── index.ts            # 主入口，参数解析
│   │   ├── bootstrap.ts        # 启动引导
│   │   └── commands/           # CLI 子命令
│   │       ├── chat.ts
│   │       ├── run.ts
│   │       ├── config.ts
│   │       ├── skill.ts
│   │       └── mcp.ts
│   │
│   ├── ui/                     # Ink/React 终端 UI
│   │   ├── App.tsx
│   │   ├── ChatView.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── DiffView.tsx
│   │   ├── FilePreview.tsx
│   │   ├── StatusBar.tsx
│   │   ├── InputBox.tsx
│   │   ├── ToolCallCard.tsx
│   │   ├── AgentTree.tsx
│   │   ├── Spinner.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── themes/
│   │       ├── default.ts
│   │       ├── dark.ts
│   │       └── light.ts
│   │
│   ├── agent/                  # Agent 系统核心
│   │   ├── Agent.ts
│   │   ├── Orchestrator.ts
│   │   ├── SubAgent.ts
│   │   ├── AgentPool.ts
│   │   ├── AgentLoop.ts
│   │   ├── TaskDecomposer.ts
│   │   ├── ResultAggregator.ts
│   │   └── types.ts
│   │
│   ├── context/                # 上下文管理
│   │   ├── ContextManager.ts
│   │   ├── TokenCounter.ts
│   │   ├── HistoryManager.ts
│   │   ├── Summarizer.ts
│   │   ├── FileContext.ts
│   │   └── Prioritizer.ts
│   │
│   ├── tools/                  # 105 工具系统
│   │   ├── ToolRegistry.ts
│   │   ├── ToolExecutor.ts
│   │   ├── ToolValidator.ts
│   │   ├── ToolSandbox.ts
│   │   ├── DynamicTool.ts
│   │   ├── tool-types.ts
│   │   └── builtin/
│   │       ├── filesystem/     # 15 工具
│   │       ├── search/         # 10 工具
│   │       ├── shell/          # 15 工具
│   │       ├── network/        # 12 工具
│   │       ├── code/           # 10 工具
│   │       ├── database/       # 8 工具
│   │       ├── data/           # 10 工具
│   │       ├── security/       # 6 工具
│   │       ├── project/        # 8 工具
│   │       ├── ai/             # 6 工具
│   │       └── system/         # 5 工具
│   │
│   ├── mcp/                    # MCP 客户端
│   │   ├── MCPClient.ts
│   │   ├── StdioTransport.ts
│   │   ├── SSETransport.ts
│   │   ├── ConfigLoader.ts
│   │   ├── ToolAdapter.ts
│   │   ├── ResourceAdapter.ts
│   │   └── types.ts
│   │
│   ├── skills/                 # Skills 引擎
│   │   ├── SkillEngine.ts
│   │   ├── SkillLoader.ts
│   │   ├── SkillExecutor.ts
│   │   ├── SkillCreator.ts
│   │   ├── SkillTrigger.ts
│   │   ├── SkillRegistry.ts
│   │   └── types.ts
│   │
│   ├── model/                  # 模型 API 层
│   │   ├── DeepSeekClient.ts
│   │   ├── MessageBuilder.ts
│   │   ├── StreamHandler.ts
│   │   ├── ThinkMode.ts
│   │   ├── RetryManager.ts
│   │   └── types.ts
│   │
│   ├── core/                   # 核心基础模块
│   │   ├── config.ts
│   │   ├── logger.ts
│   │   ├── eventbus.ts
│   │   ├── sandbox.ts
│   │   ├── process.ts
│   │   ├── storage.ts
│   │   ├── crypto.ts
│   │   └── constants.ts
│   │
│   └── index.ts
│
├── skills/                     # 内置 Skills
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

## 5. Agent 系统设计

### 5.1 架构模式：树形委派

```
                    ┌──────────────┐
                    │   User Input  │
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │   Main Agent  │  (Orchestrator)
                    └──────┬───────┘
              ┌────────────┼────────────┐
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
        │ Sub-Agent │ │Sub-Agent│ │Sub-Agent │
        │  #1       │ │  #2    │ │  #3      │
        └───────────┘ └────────┘ └──────────┘
```

### 5.2 Agent 生命周期状态机

```
CREATED → THINKING → EXECUTING → WAITING → COMPLETED
                                          → FAILED
                                          → CANCELLED
```

### 5.3 关键约束

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大子 Agent 数 | 5 | 并发 fork 上限 |
| 最大递归深度 | 2 | 子→孙，孙不能再 fork |
| 子 Agent 超时 | 120,000ms | 超时自动终止 |
| 每层 Token 预算 | 80,000 | 防止上下文失控 |
| 结果摘要上限 | 5,000 字符 | 子 Agent 回传摘要截断 |

### 5.4 单 Agent 模式

任务复杂度判定为"简单"时，不启动子 Agent，主 Agent 直接完成：

```
User → Main Agent → Tool Executor → Result
```

复杂度判定规则：
- 单文件操作：单 Agent
- 涉及 < 3 个独立子任务：单 Agent
- 超过 3 个独立子任务或跨多模块：树形委派

---

## 6. 105 内置工具体系

### 6.1 工具接口定义

```typescript
interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: JSONSchema;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
  dangerous?: boolean;
  requiresApproval?: boolean;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

### 6.2 工具分类清单

#### 文件系统操作（15）
`read_file`, `write_file`, `edit_file`, `delete_file`, `list_dir`, `glob_find`, `move_file`, `copy_file`, `create_dir`, `file_info`, `watch_file`, `batch_read`, `batch_write`, `diff_files`, `merge_files`

#### 搜索与代码检索（10）
`grep_search`, `codebase_search`, `symbol_search`, `find_references`, `find_definition`, `text_search`, `fuzzy_find`, `regex_find`, `search_package`, `search_docs`

#### Shell & 终端管理（15）
`run_command`, `run_async`, `check_status`, `stop_command`, `pipe_commands`, `shell_script`, `background_terminal`, `send_keys`, `send_ctrl_keys`, `send_text`, `terminal_screenshot`, `terminal_resize`, `list_terminals`, `kill_terminal`, `interactive_terminal`

#### 网络 & Web（12）
`web_fetch`, `web_search`, `http_request`, `download_file`, `api_call`, `graphql_query`, `websocket_connect`, `check_url`, `screenshot_page`, `parse_html`, `browser_action`, `proxy_request`

#### 代码解析与生成（10）
`parse_ast`, `format_code`, `lint_code`, `type_check`, `generate_code`, `refactor_code`, `extract_function`, `analyze_deps`, `import_organizer`, `code_metrics`

#### 数据库操作（8）
`sql_query`, `sql_migrate`, `nosql_query`, `db_schema`, `db_backup`, `db_restore`, `redis_command`, `orm_generate`

#### 数据处理（10）
`json_parse`, `csv_parse`, `xml_parse`, `yaml_parse`, `toml_parse`, `data_transform`, `data_validate`, `data_diff`, `template_render`, `chart_generate`

#### 安全与密钥（6）
`secret_scan`, `encrypt_file`, `decrypt_file`, `hash_generate`, `jwt_decode`, `vulnerability_check`

#### 项目工程（8）
`npm_manage`, `project_init`, `build_project`, `run_test`, `coverage_report`, `env_manage`, `config_manage`, `docker_manage`

#### AI 专用工具（6）
`token_count`, `context_summarize`, `prompt_template`, `skill_create`, `tool_create`, `memory_store`

#### 系统与监控（5）
`process_list`, `system_info`, `resource_monitor`, `notify_user`, `log_viewer`

### 6.3 工具安全分级

| 级别 | 工具示例 | 行为 |
|------|----------|------|
| **安全** | `read_file`, `list_dir`, `grep_search` | 自动批准，无需确认 |
| **需确认** | `write_file`, `delete_file`, `run_command` | 弹确认对话框 |
| **危险** | `sudo_command`, `kill_terminal` | 需用户显式授权 |

---

## 7. Skills 引擎设计

### 7.1 Skill 文件格式

每个 Skill 由两个文件组成：

```
skills/<skill-name>/
├── skill.md          # 指令文件（必需）
└── skill.js          # 代码实现（可选）
```

### 7.2 skill.md 结构

```markdown
---
name: pdf
description: PDF 文件的创建、解析、编辑、合并与导出
version: 1.0.0
author: deeper
triggers:
  - pdf
  - 合并pdf
  - 提取pdf
  - 转换pdf
tools:
  - read_file
  - write_file
  - run_command
dependencies:
  - pdf-lib
  - pdf-parse
---

# PDF Skill

## 概述
处理所有 PDF 相关操作。

## 工作流程
1. 解析用户意图
2. 调用 skill.js 中的对应函数
3. 返回处理结果

## 最佳实践
- 大文件先分块处理
```

### 7.3 Skill 引擎能力

| 能力 | 说明 |
|------|------|
| 自动发现 | 扫描 `~/.deeper/skills/` 和项目 `.deeper/skills/` |
| 触发匹配 | 根据用户输入关键词自动推荐 Skill |
| 热加载 | 文件变更自动重新加载 |
| 沙箱执行 | 代码型 Skill 在 isolated-vm 中运行 |
| 工具权限 | Skill 声明所需工具，超出需授权 |
| AI 自创建 | `skill_create` 工具生成新 Skill |
| 社区导入 | 支持从 URL/Git 导入外部 Skill |

### 7.4 AI 创建 Skill 流程

```
用户: "帮我创建一个自动生成 CHANGELOG 的 skill"
→ AI 理解需求 → 生成 skill.md → 生成 skill.js → 写入目录 → 注册引擎 → 反馈确认
```

---

## 8. MCP 集成设计

### 8.1 传输协议支持

| 协议 | 状态 | 用途 |
|------|------|------|
| stdio | 支持 | 本地 MCP Server 进程 |
| SSE/HTTP | 支持 | 远程 MCP 服务 |

### 8.2 MCP 协议覆盖

| 能力 | 支持 | 说明 |
|------|------|------|
| Tools | 完全支持 | 注册为可用工具 |
| Resources | 完全支持 | 资源访问 |
| Prompts | 完全支持 | 预定义提示词 |
| Sampling | 完全支持 | Server 请求 LLM |
| Roots | 完全支持 | 工作目录声明 |
| Logging | 支持 | 服务端日志 |

### 8.3 配置文件

```jsonc
// ~/.deeper/mcp.json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "type": "stdio"
    },
    "github": {
      "url": "https://mcp.github.com/sse",
      "type": "sse",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    }
  }
}
```

---

## 9. CLI UX 交互设计

### 9.1 REPL 界面布局

```
┌──────────────────────────────────────────────────┐
│  DeeperCode           deepseek-v4-pro         ⚡ │ ← 顶栏
├──────────────────────────────────────────────────┤
│  [对话区 - 可滚动]                                │
│  - Agent 分析卡片                                │
│  - 工具调用卡片                                  │
│  - Diff 预览                                    │
│  - 消息气泡（Markdown 渲染）                     │
├──────────────────────────────────────────────────┤
│  > 输入区（多行，支持快捷键）                    │
├──────────────────────────────────────────────────┤
│  📊 Tokens: 12,450/131,072 | 内存: 320MB        │ ← 状态栏
└──────────────────────────────────────────────────┘
```

### 9.2 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 发送消息 |
| `Ctrl+K` | 切换多行输入 |
| `Ctrl+C` | 中断/退出（需二次确认） |
| `Ctrl+L` | 清屏 |
| `Ctrl+R` | 搜索历史 |
| `↑/↓` | 浏览历史命令 |
| `Tab` | 智能补全 |
| `Esc` | 取消当前操作 |

### 9.3 斜杠命令

```
/help, /config, /model, /skill list, /skill create,
/mcp list, /mcp add, /mcp connect, /memory, /clear,
/export, /session new, /session list, /tools,
/theme, /debug, /quit
```

---

## 10. 配置系统

### 10.1 配置层级（优先级从高到低）

1. 命令行参数
2. 环境变量（`DEEPER_*` 前缀）
3. 项目级 `.deeper/config.json`
4. 用户级 `~/.deeper/config.json`
5. 默认配置

### 10.2 核心配置项

| 分类 | 配置项 | 默认值 |
|------|--------|--------|
| model | model | `deepseek-v4-pro` |
| model | base_url | `https://api.deepseek.com` |
| model | temperature | `0.7` |
| model | think.enabled | `true` |
| model | think.budget | `32000` |
| agent | max_sub_agents | `5` |
| agent | max_recursion_depth | `2` |
| agent | sub_agent_timeout_ms | `120000` |
| context | max_tokens | `100000` |
| context | auto_summarize_threshold | `80000` |
| ui | theme | `dark` |
| ui | show_token_count | `true` |

---

## 11. 核心数据流

```
用户输入 → CLI Entry → Orchestrator（任务分解）
    → Agent Loop（Think→Act→Observe）
    → Tool Executor（内置/MCP/Skill 工具）
    → DeepSeek API（流式响应）
    → Context Manager（更新上下文）
    → UI 渲染（流式输出）
    → 循环至 Orchestrator
```

---

## 12. 分发与安装

```bash
# 全局安装
npm install -g deeper

# 配置 API Key
deeper config set api_key "sk-xxx"

# 进入 REPL
deeper

# 单次执行
deeper run "帮我创建一个 React 项目"
```

---

## 13. 测试策略

| 层级 | 覆盖目标 | 框架 |
|------|----------|------|
| 单元测试 | 每个工具函数、Agent 状态机 | Vitest |
| 集成测试 | Agent 完整流程、Skill 执行 | Vitest |
| E2E 测试 | CLI 端到端交互 | Vitest + PTY |
| 手动测试 | UI 交互验证 | 人工 |

---

## 14. 成功标准

1. 用户可通过 `npm install -g deeper` 完成安装
2. 配置 API Key 后可立即进入 REPL 交互
3. 一句话描述需求后 AI 能完成完整项目生成
4. 105 个工具全部可被 AI 正确调用
5. Skill 系统可被 AI 自创建新 Skill
6. MCP 可连接外部 Server 并注册其工具
7. 子 Agent 能正确完成委派任务并回传结果
8. 终端 UI 渲染流畅无卡顿
9. 构建产物无 TypeScript 类型错误
10. 所有单元测试和集成测试通过
