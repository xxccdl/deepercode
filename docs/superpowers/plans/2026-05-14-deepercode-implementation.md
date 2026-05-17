# DeeperCode 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 DeeperCode CLI — 基于 DeepSeek-V4-Pro 的终端 Agentic 编程工具，含 105 内置工具、树形 Agent 系统、混合 Skills 引擎、MCP 客户端。

**Architecture:** Node.js + TypeScript + Ink/React 构建 CLI REPL 界面。模块化架构：core（基础设施）→ model（API层）→ tools（105工具）→ context（上下文）→ agent（Agent系统）→ skills/MCP（扩展）→ cli/ui（入口与界面）。

**Tech Stack:** TypeScript 5.x, Node.js 20+, Ink 5, React 18, tsup, Vitest, pnpm, @modelcontextprotocol/sdk, isolated-vm

**Phases:** 9 个阶段，约 120 个任务

---

## Phase 1: 项目脚手架与核心基础设施

### Task 1: 初始化项目结构

**Files:**
- Create: `e:\deeper-code\package.json`
- Create: `e:\deeper-code\tsconfig.json`
- Create: `e:\deeper-code\tsconfig.build.json`
- Create: `e:\deeper-code\.prettierrc`
- Create: `e:\deeper-code\vitest.config