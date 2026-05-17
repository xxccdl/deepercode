<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TS">
  <img src="https://img.shields.io/npm/v/deeper" alt="npm">
  <img src="https://img.shields.io/github/license/yourname/deeper-code" alt="License">
</p>

<h1 align="center">DeeperCode</h1>
<p align="center"><strong>全栈 AI 编程代理 CLI — 比 Claude Code 和 Codex 更好用</strong></p>

<p align="center">
  <a href="#-特性">特性</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-使用指南">使用指南</a> ·
  <a href="#-命令参考">命令参考</a> ·
  <a href="#-内置工具">内置工具</a> ·
  <a href="#-技能系统">技能系统</a> ·
  <a href="#-架构">架构</a>
</p>

---

## 什么是 DeeperCode？

DeeperCode 是一款运行在**终端**中的全栈 AI 编程代理，基于 DeepSeek 大模型。它能：
- 📖 **阅读**你的项目代码，理解架构和上下文
- ✍️ **编写**完整文件，零占位符，直接可用
- 🔧 **调用**终端命令，运行构建、测试、部署
- 🧠 **记住**跨会话的工作上下文（XMemory 四类记忆）
- 🎯 **管理**多步骤任务（自动跟踪进度）
- 🔌 **扩展**通过 Skill 系统和 MCP 协议

一句话描述：**把需求告诉 DeeperCode，它会完成剩下的所有工作。**

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 🤖 **Agentic 循环** | 50 轮自动迭代，工具调用 + 结果解析 |
| 📡 **流式输出** | SSE 实时渲染，Markdown 表格/代码块/标题全支持 |
| 🛠️ **100+ 内置工具** | 文件、Shell、搜索、网络、数据库、代码分析… |
| 🎓 **Skill 系统** | 自定义技能，YAML frontmatter + JS 代码，触发器匹配 |
| 🧠 **XMemory** | 四类记忆（工作/情节/语义/过程），跨会话持久化 |
| 🔌 **MCP 协议** | 连接外部工具服务器（Stdio + SSE 传输） |
| 📋 **任务面板** | 自动跟踪多步骤任务进度 |
| 🐛 **BugScan** | 多语言静态代码扫描 |
| 📏 **Rules 系统** | 项目/全局规则自动注入 |
| 📊 **上下文压缩** | 超长对话自动摘要，防 OOM |
| ⚡ **异步 I/O** | 写入不阻塞事件循环，流畅动画 |
| 🔒 **安全分级** | safe / confirm / dangerous 三级权限 |

## 📦 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **DeepSeek API Key**（[获取地址](https://platform.deepseek.com/api_keys)）

### 安装

```bash
npm install -g deeper-cli
```

### 配置

```bash
deeper config set api_key "sk-xxxxxxxx"
deeper config set model deepseek-chat
```

### 使用

```bash
# 进入交互式 REPL
deeper

# 单次执行
deeper run "创建一个 React Todo 应用"

# 指定模型
deeper run "重构这个文件" -m deepseek-reasoner
```

## 📖 使用指南

### REPL 交互

进入后，直接输入任务描述即可：

```
❯ 帮我写一个 Express REST API，包含用户注册和登录
```

AI 会：
1. 分析需求 → 创建任务清单
2. 按步骤执行（创建文件、安装依赖、写代码）
3. 实时反馈进度
4. 完成后显示摘要

### 命令提示

输入 `/` 回车即可查看所有可用命令：

| 命令 | 说明 |
|------|------|
| `/help` | 帮助信息 |
| `/clear` | 清空对话 |
| `/save [name]` | 保存会话 |
| `/load [name]` | 加载会话 |
| `/sessions` | 会话列表 |
| `/tools [cat]` | 工具列表 |
| `/rules` | 规则管理 |
| `/tasks` | 任务列表 |
| `/memory` | 记忆系统 |
| `/mcp` | MCP 服务器 |
| `/stats` | 统计信息 |
| `/model` | 模型设置 |
| `/config` | 配置管理 |
| `/init` | 初始化项目上下文 |
| `/export` | 导出对话 |
| `/quit` | 退出 |

### 项目上下文

```bash
# 在项目目录中初始化
deeper init
```

这会创建 `deeper.md`，AI 在每次对话中自动读取。你可以自由编辑，添加项目规则和背景信息。

### Rules 规则系统

DeeperCode 支持三层规则：

```bash
~/.deeper/rules.md      # 全局规则（所有项目生效）
.deeper/rules.md        # 项目规则（当前项目生效）
deeper.md               # 项目上下文（/init 生成）
```

规则文件使用 Markdown 编写，AI 在每次对话时自动加载。例如：

```markdown
# 项目规则
- 所有组件使用 TypeScript
- API 路由统一放在 src/routes/
- 使用 pnpm 而非 npm
- React 组件必须使用函数组件
```

## 🛠️ 内置工具

100+ 内置工具，覆盖 11 个分类：

| 分类 | 工具数 | 典型工具 |
|------|--------|---------|
| `filesystem` | 15 | read_file, write_file, edit_file, batch_write, glob_find |
| `shell` | 16 | run_command, background_terminal, read_terminal, process-pool |
| `search` | 10 | grep_search, codebase_search, find_references, fuzzy_find |
| `code` | 10 | parse_ast, format_code, lint_code, bug_scan, refactor_code |
| `network` | 12 | web_fetch, web_search, api_call, parse_html, download_file |
| `ai` | 8 | todo_manager, token_count, memory_store, subagent, context_summarize |
| `data` | 10 | json_parse, csv_parse, yaml_parse, data_transform |
| `database` | 8 | sql_query, db_schema, redis_command, nosql_query |
| `project` | 8 | npm_manage, build_project, run_test, docker_manage |
| `security` | 6 | secret_scan, encrypt_file, jwt_decode, vulnerability_check |
| `system` | 5 | system_info, process_list, resource_monitor |

所有工具都有安全分级，危险操作需要用户确认。

## 🎓 技能系统

自定义技能的创建和使用：

### Skill 格式

```markdown
---
name: my-skill
description: 分析 React 组件性能
version: 1.0.0
triggers:
  - 性能分析
  - 优化组件
tools:
  - read_file
  - grep_search
---

# 组件性能分析

## 工作流程
1. 读取目标组件
2. 检查不必要的 re-render
3. 分析 useMemo/useCallback 使用
4. 给出优化建议
```

保存到 `~/.deeper/skills/my-skill/skill.md`，AI 会在对话中自动识别触发词。

### 带代码的 Skill

在 `skill.js` 中编写辅助函数，Skill 引擎会在沙箱中执行。

## 🏗️ 架构

```
src/
├── cli/            # CLI 入口 + REPL 主循环
│   ├── index.ts    # 命令路由 (chat/run/config/skill/mcp)
│   ├── chat-repl.ts # 核心 REPL 循环 (API/SSE/工具/会话)
│   └── bootstrap.ts # 启动引导
├── core/           # 基础设施
│   ├── config.ts   # 多层配置管理
│   ├── eventbus.ts # 事件总线
│   ├── bugscan.ts  # 静态代码扫描
│   └── xmemory.ts  # 四类记忆
├── model/          # AI 模型层
│   ├── DeepSeekClient.ts
│   ├── StreamHandler.ts
│   └── RetryManager.ts
├── tools/          # 工具系统 (100+ 内置工具)
│   ├── builtin/    # 11 个分类
│   ├── ToolRegistry.ts
│   ├── ToolExecutor.ts
│   └── ToolValidator.ts
├── skills/         # Skill 系统
│   ├── SkillEngine.ts
│   ├── SkillLoader.ts
│   └── SkillExecutor.ts
├── mcp/            # MCP 协议客户端
├── memory/         # XMemory 记忆系统
└── ui/             # 终端 UI
    ├── ansi.ts     # ANSI 颜色 + 动画
    └── markdown.ts # Markdown 流式渲染
```

## 🔧 开发

```bash
git clone https://github.com/yourname/deeper-code.git
cd deeper-code
npm install
npm run dev       # tsup --watch
npm run build     # tsup
npm run test      # vitest run
npm run typecheck # tsc --noEmit
```

## 📄 License

MIT © DeeperCode
