import readline from 'node:readline';
import process from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { DEEPER_HOME } from '../core/constants.js';
import { TOOL_SAFETY_MAP } from '../tools/tool-types.js';
import type { Tool } from '../tools/tool-types.js';
import { ToolValidator } from '../tools/ToolValidator.js';
import { xmemory, setSessionId } from '../memory/xmemory.js';
import { MarkdownStreamRenderer } from '../ui/markdown.js';
import { getTodos, todoSummary } from '../tools/builtin/ai/todo_manager.js';
import { estimateTokens } from '../tools/builtin/ai/token_count.js';
import { SkillEngine } from '../skills/SkillEngine.js';
import { MCPClient } from '../mcp/MCPClient.js';
import { DeepSeekClient } from '../model/DeepSeekClient.js';
import type { ChatMessage, StreamChunk } from '../model/types.js';
import { O, Oflush, A, d, b, c, g, y, r, B, G, resetTimer, thinkingAnim, thinkingAnimAt } from '../ui/ansi.js';

export interface ReplOptions {
  apiKey: string; model: string; baseUrl: string;
  maxTokens: number; temperature: number;
  thinkEnabled: boolean; thinkBudget: number;
}

type Role = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
  role: Role; content: string | null;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  tool_call_id?: string; name?: string; reasoning_content?: string;
}

interface ToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const MAX_HISTORY = 60;
const CONTEXT_LIMIT = 1_048_576;
const CTX_WARN = 786_432;
const TOOL_RESULT_MAX = 4000;
const SESSION_DIR = join(DEEPER_HOME, 'sessions');
const AUTOSAVE_FILE = join(SESSION_DIR, '_autosave.json');

const TOOL_TIMEOUT_MAP: Record<string, number> = {
  run_command: 120_000, run_async: 120_000, pipe_commands: 120_000,
  shell_script: 120_000, build_project: 180_000, run_test: 180_000,
  npm_manage: 120_000, docker_manage: 120_000, project_init: 120_000,
  web_fetch: 60_000, web_search: 60_000, http_request: 60_000,
  browser_action: 60_000, screenshot_page: 60_000,
  sql_query: 60_000, sql_migrate: 120_000, db_backup: 180_000, db_restore: 180_000,
  secret_scan: 60_000, vulnerability_check: 60_000,
  subagent: 180_000,
};
const DEFAULT_TOOL_TIMEOUT = 30_000;

let GS = { tc: 0, api: 0, ch: 0 };
let skillEngine: SkillEngine | null = null;
let mcpClient: MCPClient | null = null;
const validator = new ToolValidator();
let currentAbortController: AbortController | null = null;

const BACKUP_DIR = join(DEEPER_HOME, 'backups');
const MAX_BACKUPS = 50;
const fileBackupStack: Array<{ path: string; backupPath: string; timestamp: number }> = [];

function backupFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const rel = relative(process.cwd(), filePath).replace(/[/\\]/g, '_');
    const ts = Date.now();
    const backupPath = join(BACKUP_DIR, `${ts}_${rel}`);
    copyFileSync(filePath, backupPath);
    fileBackupStack.push({ path: filePath, backupPath, timestamp: ts });
    if (fileBackupStack.length > MAX_BACKUPS) {
      const old = fileBackupStack.shift()!;
      try { unlinkSync(old.backupPath); } catch {}
    }
  } catch {}
}

function getSkillSystemPrompt(): string {
  if (!skillEngine) return '';
  return skillEngine.getSystemPrompt();
}

export async function startRepl(opts: ReplOptions): Promise<void> {
  const tools = await loadBuiltinTools();
  const toolDefs = toolsToDefs(tools);

  const { setSubagentRunner } = await import('../tools/builtin/index.js');
  setSubagentRunner(async (task: string, mode: 'foreground' | 'background') => {
    const isBg = mode === 'background';
    const run = async () => {
      const lh: Message[] = [
        { role: 'system', content: `DeeperCode 子代理。用工具完成任务，完成输出摘要。cwd=${process.cwd()}` },
        { role: 'user', content: task },
      ];
      const tds = toolsToDefs(tools);
      let ce = 0, stag = 0;
      while (true) {
        const msgs = buildMsgs(lh);
        let fc = '', th = '';
        let tcs: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
        let curTc: { id: string; name: string; argsStr: string } | null = null;
        let se: string | null = null;
        try {
          const stream = await callApi(opts, msgs, tds, 131072); GS.api++; ce = 0;
          for await (const chunk of stream) {
            if (chunk.type === 'text') { fc += chunk.content || ''; }
            if (chunk.type === 'thinking') th += chunk.content || '';
            if (chunk.type === 'tool_call_start') {
              const tc = (chunk as any).tool_call;
              if (tc) curTc = { id: tc.id, name: tc.name, argsStr: '' };
            }
            if (chunk.type === 'tool_call_end' && curTc) {
              const tcData = (chunk as any).tool_call;
              try {
                const args = tcData?.arguments || JSON.parse(curTc.argsStr || '{}');
                tcs.push({ id: curTc.id, name: curTc.name, args });
              } catch { tcs.push({ id: curTc.id, name: curTc.name, args: {} }); }
              curTc = null;
            }
            if (chunk.type === 'done') break;
            if (chunk.type === 'error') { se = chunk.error || '?'; break; }
          }
        } catch (e: unknown) { se = e instanceof Error ? e.message : String(e); }

        if (se) { ce++; stag++; if (ce >= 2) return `子代理失败: ${se}`; await new Promise(r2 => setTimeout(r2, 1000)); continue; }

        if (tcs.length > 0) {
          stag = 0;
          lh.push({ role: 'assistant', content: fc || null, reasoning_content: th || undefined, tool_calls: tcs.map(t => ({ id: t.id, name: t.name, arguments: { ...t.args } })) });
          for (const tc of tcs) {
            const tool = tools.find(t => t.name === tc.name);
            if (!tool) { lh.push({ role: 'tool', content: `Error: unknown ${tc.name}`, tool_call_id: tc.id, name: tc.name }); continue; }
            const s2 = TOOL_SAFETY_MAP[tc.name] || 'safe';
            if (s2 === 'dangerous') { lh.push({ role: 'tool', content: 'Skipped', tool_call_id: tc.id, name: tc.name }); continue; }
            try {
              const ac = new AbortController();
              const timeout = TOOL_TIMEOUT_MAP[tc.name] || DEFAULT_TOOL_TIMEOUT;
              const timer = setTimeout(() => ac.abort(), timeout);
              const r = await tool.execute(tc.args, ac.signal);
              clearTimeout(timer);
              const txt = sanitize(r.output || '').slice(0, TOOL_RESULT_MAX);
              lh.push({ role: 'tool', content: r.success ? txt : `Error: ${(r as any).error}`, tool_call_id: tc.id, name: tc.name });
              GS.tc++;
            } catch (e: unknown) { lh.push({ role: 'tool', content: `Error: ${e instanceof Error ? e.message : String(e)}`, tool_call_id: tc.id, name: tc.name }); }
          }
          trimHistory(lh, 20); continue;
        }
        if (fc) { lh.push({ role: 'assistant', content: fc, reasoning_content: th || undefined }); stag = 0; }
        else { stag++; if (stag >= 3) return `停滞: 连续${stag}轮无进展`; continue; }
        const final = lh[lh.length - 1]?.content || '完成';
        return final.slice(0, 800);
      }
    };

    if (isBg) {
      run().then(result => {
        history.push({ role: 'system', content: `[子代理] ${task.slice(0, 50)} → ${result.slice(0, 300)}` });
      });
      return `后台子代理已启动: ${task.slice(0, 80)}`;
    } else {
      O(G(`  🟊 subagent  ${task.slice(0, 60)}...\n`));
      const result = await run();
      return result;
    }
  });

  const history: Message[] = [];
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });

  const sid = `sess_${Date.now()}`;
  setSessionId(sid);
  await xmemory.load();
  const prevCount = xmemory.totalEntries;
  const prevSummary = xmemory.getSessionSummary();
  if (prevSummary) {
    history.push({ role: 'system', content: `[跨会话记忆·已加载 ${prevCount} 条]\n${prevSummary.slice(0, 800)}` });
  }

  skillEngine = new SkillEngine();
  let skillCount = 0;
  try { skillCount = await skillEngine.loadAll(); } catch { /* skills optional */ }

  let mcpCount = 0;
  let mcpToolCount = 0;
  try {
    mcpClient = new MCPClient();
    const { getConfig } = await import('../core/config.js');
    const cfg = getConfig();
    const servers = cfg.mcpServers || [];
    for (const srv of servers) {
      if (!srv.enabled || !srv.autoConnect) continue;
      try {
        const mcpConfig: { name: string; type: 'stdio' | 'sse'; command?: string; args?: string[]; url?: string; env?: Record<string, string> } = {
          name: srv.name,
          type: srv.url ? 'sse' : 'stdio',
        };
        if (srv.command) { mcpConfig.command = srv.command; mcpConfig.args = srv.args; }
        if (srv.url) mcpConfig.url = srv.url;
        await mcpClient.connect(mcpConfig);
        mcpCount++;
      } catch (e: unknown) {
        O(y(`  MCP ${srv.name} 连接失败: ${e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60)}\n`));
      }
    }
    if (mcpCount > 0) {
      const mcpTools = mcpClient.getAdaptedTools();
      mcpToolCount = mcpTools.length;
      tools.push(...mcpTools);
    }
  } catch { /* MCP optional */ }

  const drawHeader = (sCount = skillCount, mc = mcpCount, mt = mcpToolCount) => {
    O('\x1b[2J\x1b[H');
    O(b(c('  DeeperCode')) + G(' · 全栈 AI 编程代理') + '\n');
    const modes: string[] = [`${tools.length}工具`];
    if (xmemory.totalEntries > 0) modes.push(`${xmemory.totalEntries}记忆`);
    if (sCount > 0) modes.push(`${sCount}技能`);
    if (mc > 0) modes.push(`${mc}MCP·${mt}工具`);
    O(G(`  ▸ V4-Pro · ${modes.join(' · ')}`) + '\n\n');
  };
  drawHeader();

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => { resizeTimer = null; Oflush(); }, 200);
  };
  process.stdout.on('resize', onResize);

  let resolveLine: ((v: string) => void) | null = null;
  let running = true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let currentPrompt = c('❯ ');
  const showPrompt = () => { Oflush(); rl.setPrompt(currentPrompt); rl.prompt(true); };
  rl.on('line', (line: string) => { if (resolveLine) { const cb = resolveLine; resolveLine = null; cb(line); } });
  const ask = (): Promise<string> => new Promise(r => { resolveLine = r; showPrompt(); });
  const confirm = async (msg: string): Promise<boolean> => {
    const sv = resolveLine; resolveLine = null;
    O(y(`\n  ⚠ ${msg} [y/N] `));
    const a = await new Promise<string>(r2 => { resolveLine = r2; rl.prompt(true); });
    const ok = a.toLowerCase().startsWith('y');
    if (sv) resolveLine = sv; else showPrompt();
    return ok;
  };

  const onSigint = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
      O(y('\n  ⚡ 已中断当前请求\n'));
      return;
    }
    if (resolveLine) { const cb = resolveLine; resolveLine = null; cb('/quit'); return; }
    Oflush();
    process.stdout.removeListener('resize', onResize);
    process.removeListener('uncaughtException', onUCE);
    process.removeListener('unhandledRejection', onUHR);
    xmemory.save().then(() => { O('\n' + y('再见！') + '\n'); running = false; rl.close(); process.exit(0); });
  };
  rl.on('SIGINT', onSigint);
  const onUCE = (err: Error) => { if (!err.message?.includes('readline') && !err.message?.includes('abort')) O(r(`\n  ⚠ ${err.message}`) + '\n'); };
  process.on('uncaughtException', onUCE);
  const onUHR = (reason: unknown) => { const m = reason instanceof Error ? reason.message : String(reason); if (!m.includes('readline') && !m.includes('Abort') && !m.includes('timeout')) O(r(`\n  ⚠ ${m}`) + '\n'); };
  process.on('unhandledRejection', onUHR);

  while (running) {
    currentPrompt = c('❯ ');
    const tasks = getTodos();
    if (tasks.length > 0) {
      const active = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      if (active.length > 0) currentPrompt = c(`❯ [${active.length}/${tasks.length}] `);
    }

    const input = await ask();
    const trimmed = input.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('/')) {
      if (trimmed === '/') {
        O(c('  可用命令:\n'));
        O(G('  /help') + G('      帮助信息') + '\n');
        O(G('  /clear') + G('     清空对话') + '\n');
        O(G('  /quit') + G('      退出') + '\n');
        O(G('  /save') + G(' [n]  保存会话') + '\n');
        O(G('  /load') + G(' [n]  加载会话') + '\n');
        O(G('  /sessions') + G('  会话列表') + '\n');
        O(G('  /tools') + G(' [c]  工具列表') + '\n');
        O(G('  /stats') + G('     统计信息') + '\n');
        O(G('  /memory') + G('    记忆系统') + '\n');
        O(G('  /tasks') + G('     任务列表') + '\n');
        O(G('  /rules') + G('     规则管理') + '\n');
        O(G('  /mcp') + G('       MCP服务器') + '\n');
        O(G('  /plan') + G(' <任务> 先出方案') + '\n');
        O(G('  /spec') + G(' <任务> 先出规格') + '\n');
        O(G('  /review') + G(' <路径> 代码审查') + '\n');
        O(G('  /fix') + G(' [目标] 自动修复') + '\n');
        O(G('  /commit') + G('    智能提交') + '\n');
        O(G('  /analyze') + G(' [路径] 项目分析') + '\n');
        O(G('  /diff') + G(' <文件> 变更预览') + '\n');
        O(G('  /undo') + G('      撤销操作') + '\n');
        O(G('  /status') + G('    当前状态') + '\n');
        O(G('  /model') + G('     模型设置') + '\n');
        O(G('  /config') + G('    配置管理') + '\n');
        O(G('  /cwd') + G('       当前目录') + '\n');
        O(G('  /export') + G('    导出对话') + '\n');
        O(G('  /delete [n]') + G(' 删除会话') + '\n');
        O(G('  /init') + G('      初始化项目') + '\n');
        O('\n'); continue;
      }
      const [cmd, ...rest] = trimmed.split(/\s+/);
      const arg = rest.join(' ');
      if (cmd === '/quit') break;
      if (cmd === '/clear') { history.length = 0; O('\x1b[2J\x1b[H' + g('已清空') + '\n\n'); continue; }
      if (cmd === '/save') { await saveSession(history, arg); continue; }
      if (cmd === '/load' || cmd === '/resume') {
        if (arg) await loadNamedSession(history, arg);
        else await loadLatestSession(history);
        continue;
      }
      if (cmd === '/sessions') { await listSessions(); continue; }
      if (cmd === '/tools') { if (arg) await showToolsOf(arg, tools); else await showToolsBrief(tools); continue; }
      if (cmd === '/stats') { O(B(`▸ API:${GS.api} 工具:${GS.tc} 字符:${GS.ch}`) + '\n\n'); continue; }
      if (cmd === '/memory') { await showMemory(); continue; }
      if (cmd === '/tasks') { await showTasks(); continue; }
      if (cmd === '/model') { O(c('模型: deepseek-v4-pro | deepseek-v4-flash\n  deeper config set model <name>\n\n')); continue; }
      if (cmd === '/config') { O(c('配置: deeper config list | deeper config set <key> <value>\n\n')); continue; }
      if (cmd === '/cwd') { O(G(`  ${process.cwd()}\n\n`)); continue; }
      if (cmd === '/export') { await exportHistory(history); continue; }
      if (cmd === '/delete' || cmd === '/rm') {
        if (!arg) {
          if (!existsSync(SESSION_DIR)) { O(r('  无保存的会话\n\n')); continue; }
          const files = readdirSync(SESSION_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().reverse();
          if (!files.length) { O(r('  无保存的会话\n\n')); continue; }
          O(b(c('  Sessions')) + G(` · ${files.length} 个`) + '\n');
          O(G(`  用法: /delete <名称> 删除指定会话\n`));
          for (let i = 0; i < Math.min(files.length, 15); i++) {
            const f = files[i];
            try {
              const data = JSON.parse(readFileSync(join(SESSION_DIR, f), 'utf-8'));
              const label = f.replace(/^sess_|\.json$/g, '');
              O(G(`    ${i + 1}. `) + c(label) + G(` · ${(data.messages?.length || 0)}条 · ${data.savedAt?.slice(0, 16) || '?'}`) + '\n');
            } catch {}
          }
          O('\n'); continue;
        }
        const targetFile = join(SESSION_DIR, `sess_${arg}.json`);
        if (existsSync(targetFile)) {
          unlinkSync(targetFile);
          O(g(`已删除: ${arg}\n\n`));
        } else {
          O(r(`  会话不存在: ${arg}\n\n`));
        }
        continue;
      }
      if (cmd === '/init') { await initProject(); continue; }
      if (cmd === '/status') { O(B(`▸ API:${GS.api} 工具:${GS.tc} 字符:${GS.ch} · 上下文:${history.length}条`) + '\n\n'); continue; }
      if (cmd === '/mcp') {
        if (!mcpClient) { O(y('  MCP 未初始化\n\n')); continue; }
        const servers = mcpClient.getConnectedServers();
        if (!servers.length) { O(G('  无已连接的 MCP 服务器\n  使用 deeper mcp add 添加\n\n')); continue; }
        O(b(c('  MCP Servers')) + G(` · ${servers.length} 个`) + '\n');
        for (const name of servers) {
          const mcpTools = mcpClient.listTools(name);
          O(G(`  📡 ${name}`) + G(` · ${mcpTools.length} 工具`) + '\n');
          for (const t of mcpTools.slice(0, 5)) O(G(`    - ${t.name}: ${t.description.slice(0, 50)}`) + '\n');
          if (mcpTools.length > 5) O(G(`    …还有 ${mcpTools.length - 5} 个`) + '\n');
        }
        O('\n'); continue;
      }
      if (cmd === '/rules') {
        const projectRules = join(process.cwd(), '.deeper', 'rules.md');
        const globalRules = join(DEEPER_HOME, 'rules.md');
        O(b(c('  Rules')) + '\n');
        const showRules = (label: string, path: string) => {
          if (existsSync(path)) {
            const content = readFileSync(path, 'utf-8');
            O(G(`  ${label}: `) + c(path) + G(` (${content.split('\n').length}行)`) + '\n');
            const lines = content.split('\n').slice(0, 8);
            for (const l of lines) O(G(`    ${l.slice(0, 70)}`) + '\n');
            if (content.split('\n').length > 8) O(G('    …') + '\n');
          } else {
            O(G(`  ${label}: `) + y('未设置') + G(` (创建: ${path})`) + '\n');
          }
        };
        showRules('项目规则', projectRules);
        showRules('全局规则', globalRules);
        O('\n'); continue;
      }
      if (cmd === '/help') {
        O(c('  /help /clear /quit /save [name] /load|resume [name] /sessions\n'));
        O(c('  /tools [cat] /stats /memory /tasks /model /config /cwd /export /init /mcp /rules\n'));
        O(c('  /plan <任务> /spec <任务> /review <路径> /fix [目标]\n'));
        O(c('  /commit /analyze [路径] /diff <文件> /undo /delete [n] /status\n\n'));
        continue;
      }
      if (cmd === '/plan') {
        if (!arg) { O(y('  用法: /plan <任务描述>\n\n')); continue; }
        O(b(c('  Plan Mode')) + G(` • ${arg.slice(0, 50)}`) + '\n\n');
        history.push({ role: 'system', content: `[Plan Mode]
你必须遵循以下流程，严格按步骤执行：
1. 先输出一份详尽的实施方案（不要写代码）
2. 方案必须包含：需求分析、技术选型、架构设计、数据流、模块划分、实施步骤
3. 等待用户确认方案（输入 ok/继续/可以 等确认词）
4. 用户确认后，按方案逐步实施，每完成一步更新 todo
5. 完成后总结交付内容

当前任务：${arg}` });
        history.push({ role: 'user', content: arg });
        const pfdefs = toolsToDefs(tools);
        await runLoop(opts, history, tools, pfdefs, confirm);
        continue;
      }
      if (cmd === '/spec') {
        if (!arg) { O(y('  用法: /spec <任务描述>\n\n')); continue; }
        O(b(c('  Spec Mode')) + G(` • ${arg.slice(0, 50)}`) + '\n\n');
        history.push({ role: 'system', content: `[Spec Mode]
你必须遵循以下流程，严格按步骤执行：
1. 先输出一份完整的产品规格文档（不要写代码）
2. 规格文档必须包含：需求概述、功能清单、交互设计、数据结构、API设计、组件树、非功能性需求、测试策略、里程碑
3. 文档使用 Markdown 格式，标题用 # 层次清晰
4. 等待用户确认规格（输入 ok/继续/可以 等确认词）
5. 用户确认后，按规格逐步实施，每完成一步更新 todo
6. 完成后总结交付内容

当前任务：${arg}` });
        history.push({ role: 'user', content: arg });
        const sfdefs = toolsToDefs(tools);
        await runLoop(opts, history, tools, sfdefs, confirm);
        continue;
      }
      if (cmd === '/review') {
        const target = arg || '.';
        O(b(c('  Review Mode')) + G(` • ${target}`) + '\n\n');
        history.push({ role: 'system', content: `[Review Mode]
你是一位资深代码审查专家。请对指定代码进行全面审查：

1. 先用 read_file / glob_find / grep_search 读取相关代码
2. 从以下维度逐项审查并评分（1-10）：
   - 代码质量：可读性、命名、结构
   - 安全性：注入、XSS、密钥泄露、权限问题
   - 性能：N+1查询、内存泄漏、不必要的计算
   - 可维护性：耦合度、重复代码、测试覆盖
   - 最佳实践：设计模式、SOLID原则、错误处理
3. 对每个问题给出：文件路径、行号范围、问题描述、修复建议、严重程度(🔴高/🟡中/🟢低)
4. 最后给出总体评分和改进优先级列表

审查目标：${target}` });
        history.push({ role: 'user', content: `审查 ${target} 的代码质量` });
        const rvdefs = toolsToDefs(tools);
        await runLoop(opts, history, tools, rvdefs, confirm);
        continue;
      }
      if (cmd === '/commit') {
        O(b(c('  Commit Mode')) + G(' • 智能提交') + '\n\n');
        try {
          const statusOut = execSync('git status --porcelain', { encoding: 'utf-8', timeout: 10000, cwd: process.cwd() });
          if (!statusOut.trim()) { O(y('  没有未提交的变更\n\n')); continue; }
          const diffOut = execSync('git diff --stat', { encoding: 'utf-8', timeout: 15000, cwd: process.cwd() });
          const stagedOut = execSync('git diff --cached --stat', { encoding: 'utf-8', timeout: 15000, cwd: process.cwd() });
          const files = statusOut.trim().split('\n').filter(Boolean);
          O(G(`  ${files.length} 个文件变更:\n`));
          for (const f of files.slice(0, 20)) {
            const status = f.slice(0, 2).trim();
            const path = f.slice(3);
            const icon = status === 'M' ? y('M') : status === 'A' ? g('A') : status === 'D' ? r('D') : status === '?' ? G('?') : c(status);
            O(G(`    ${icon} ${path.slice(0, 60)}`) + '\n');
          }
          if (files.length > 20) O(G(`    …还有 ${files.length - 20} 个`) + '\n');
          O('\n');
          history.push({ role: 'system', content: `[Commit Mode]
分析 git 变更并生成提交信息：
1. 先用 run_command 执行 git diff 查看具体变更内容
2. 分析变更类型和范围，生成符合 Conventional Commits 规范的提交信息
3. 格式: type(scope): description
   - type: feat/fix/refactor/docs/style/test/chore/perf
   - scope: 可选，影响的模块
4. 用 run_command 执行 git add 和 git commit
5. 如果变更较多，建议分多次提交

当前变更统计：
${diffOut || stagedOut || '无staged变更'}` });
          history.push({ role: 'user', content: '分析变更并提交' });
          const cmdefs = toolsToDefs(tools);
          await runLoop(opts, history, tools, cmdefs, confirm);
        } catch (e: unknown) {
          O(r(`  Git 操作失败: ${e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)}\n\n`));
        }
        continue;
      }
      if (cmd === '/analyze') {
        const target = arg || process.cwd();
        O(b(c('  Analyze Mode')) + G(` • ${target}`) + '\n\n');
        history.push({ role: 'system', content: `[Analyze Mode]
你是一位项目架构分析师。请对项目进行全面分析：

1. 用 glob_find 扫描项目目录结构
2. 用 read_file 读取 package.json / tsconfig.json / Cargo.toml 等配置
3. 用 grep_search / codebase_search 分析代码模式
4. 输出以下分析报告：
   - 📁 项目结构树（关键目录和文件）
   - 🛠 技术栈识别（语言、框架、库、工具链）
   - 📊 代码统计（文件数、代码行数估算、各语言占比）
   - 🏗️ 架构模式（MVC/微服务/单体/插件式等）
   - 🔗 依赖关系（核心依赖、开发依赖、版本风险）
   - ⚠️ 潜在问题（过时依赖、安全风险、代码异味）
   - 💡 改进建议（优先级排序）

分析目标：${target}` });
        history.push({ role: 'user', content: `分析项目 ${target}` });
        const andefs = toolsToDefs(tools);
        await runLoop(opts, history, tools, andefs, confirm);
        continue;
      }
      if (cmd === '/fix') {
        const target = arg || '';
        O(b(c('  Fix Mode')) + G(' • 自动修复') + '\n\n');
        history.push({ role: 'system', content: `[Fix Mode]
你是一位自动修复工程师。请执行以下流程：

1. 先用 run_command 运行构建命令（如 npm run build, tsc --noEmit, cargo check 等）
2. 如果构建成功，运行测试（npm test, cargo test 等）
3. 如果有错误：
   a. 仔细分析错误信息，定位到具体文件和行号
   b. 用 read_file 读取出错文件的相关代码
   c. 理解错误根因，制定修复方案
   d. 用 edit_file 精确修复（优先用 edit 而非重写整个文件）
   e. 重新运行构建验证修复
   f. 重复直到所有错误清除
4. 如果测试失败，同样分析并修复
5. 最多尝试修复 5 轮，避免无限循环
6. 每次修复后都重新验证

${target ? `修复目标：${target}\n` : '自动检测并修复所有构建/测试错误'}` });
        history.push({ role: 'user', content: target || '检测并修复项目错误' });
        const fxdefs = toolsToDefs(tools);
        await runLoop(opts, history, tools, fxdefs, confirm);
        continue;
      }
      if (cmd === '/diff') {
        if (!arg) { O(y('  用法: /diff <文件路径>\n  显示文件最近的变更\n\n')); continue; }
        const filePath = arg.startsWith('/') || arg.startsWith('\\') || arg.length > 2 ? arg : join(process.cwd(), arg);
        if (fileBackupStack.length === 0) { O(y('  没有可用的备份记录\n\n')); continue; }
        const backups = fileBackupStack.filter(b => b.path === filePath).reverse();
        if (backups.length === 0) {
          const allBackups = [...fileBackupStack].reverse();
          O(G('  最近的文件变更:\n'));
          for (const b of allBackups.slice(0, 10)) {
            const rel = relative(process.cwd(), b.path);
            const time = new Date(b.timestamp).toLocaleTimeString();
            O(G(`    ${time} ${rel.slice(0, 50)}`) + '\n');
          }
          O('\n'); continue;
        }
        const latest = backups[0];
        try {
          const currentContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '(文件已删除)';
          const backupContent = readFileSync(latest.backupPath, 'utf-8');
          const diffResult = computeSimpleDiff(backupContent, currentContent, filePath);
          O(b(c('  Diff')) + G(` • ${relative(process.cwd(), filePath)}`) + '\n\n');
          O(diffResult + '\n\n');
        } catch {
          O(y('  无法读取文件进行对比\n\n'));
        }
        continue;
      }
      if (cmd === '/undo') {
        if (fileBackupStack.length === 0) { O(y('  没有可撤销的操作\n\n')); continue; }
        const last = fileBackupStack[fileBackupStack.length - 1];
        try {
          const rel = relative(process.cwd(), last.path);
          copyFileSync(last.backupPath, last.path);
          fileBackupStack.pop();
          try { unlinkSync(last.backupPath); } catch {}
          O(g('  ✓ 已撤销') + G(` ${rel}`) + '\n');
          O(G('  提示: 可继续 /undo 撤销更多操作\n\n'));
        } catch (e: unknown) {
          O(r(`  撤销失败: ${e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60)}\n\n`));
        }
        continue;
      }
      O(G(`  未知命令: ${cmd} (输入 /help 查看帮助)\n\n`));
      continue;
    }

    const fdefs = toolsToDefs(tools);
    O('\n');
    const um: Message = { role: 'user', content: trimmed };
    history.push(um); trimHistory(history, MAX_HISTORY);
    await runLoop(opts, history, tools, fdefs, confirm);
  }

  rl.close();
  Oflush();
  process.stdout.removeListener('resize', onResize);
  process.removeListener('uncaughtException', onUCE);
  process.removeListener('unhandledRejection', onUHR);
  await xmemory.save();
  if (mcpClient) mcpClient.disconnectAll();
  Oflush();
  O(y('\n再见！\n')); process.exit(0);
}

// ========== Core loop ==========

async function runLoop(
  opts: ReplOptions, history: Message[], tools: Tool[],
  toolDefs: ToolDef[], confirm: (msg: string) => Promise<boolean>,
): Promise<void> {
  let ttc = 0, ce = 0, stagnation = 0;

  for (let iter = 0; ; iter++) {
    const ctxTokens = estimateTokens(history.map(m => m.content || '').join('\n'));
    const toolsTokenOverhead = toolDefs.length * 80;
    const totalCtx = ctxTokens + toolsTokenOverhead;
    const nearLimit = totalCtx > CONTEXT_LIMIT * 0.95;

    if (totalCtx > CONTEXT_LIMIT * 0.7 && history.length > 10) {
      compressHistory(history);
    }

    if (stagnation >= 5) {
      O(y(`\n  连续${stagnation}轮无进展，任务交还\n\n`));
      return;
    }

    const msgs = buildMsgs(history);
    const st = Date.now();
    let fc = '', th = '';
    let tcs: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
    let curTc: { id: string; name: string; argsStr: string } | null = null;
    let se: string | null = null;
    const amax = iter === 0 ? 131072 : nearLimit ? 32768 : 65536;
    let showingThink = false;

    resetTimer();
    const animLabel = () => showingThink ? '思考中' : '解析中';
    const animTick = () => { O('\r' + thinkingAnim(animLabel())); };
    let thinkAnimIv: ReturnType<typeof setInterval> | null = null;
    animTick();
    thinkAnimIv = setInterval(animTick, 80);
    const md = new MarkdownStreamRenderer();

    const startStreamAnim = () => {
      if (thinkAnimIv) return;
      resetTimer();
      animTick();
      thinkAnimIv = setInterval(animTick, 80);
    };
    const stopStreamAnim = () => {
      if (thinkAnimIv) { clearInterval(thinkAnimIv); thinkAnimIv = null; }
    };

    currentAbortController = new AbortController();

    try {
      const stream = await callApi(opts, msgs, toolDefs, amax, currentAbortController.signal);
      GS.api++; ce = 0;

      const cols = process.stdout.columns || 80;

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          const t = chunk.content || '';
          fc += t;
          if (fc.length > 100_000) fc = fc.slice(-80_000);
          if (fc === t) {
            if (showingThink) { showingThink = false; stopStreamAnim(); }
            Oflush(); O('\r' + ' '.repeat(cols) + '\r');
            if (fc.length === t.length) O(b(c('●')) + ' ');
          }
          const rendered = md.feed(t);
          if (rendered) O(rendered);
          GS.ch += t.length;
        }
        if (chunk.type === 'thinking') {
          if (!showingThink) { showingThink = true; startStreamAnim(); }
          th += chunk.content || '';
          if (th.length > 20_000) th = th.slice(-16_000);
        }
        if (chunk.type === 'tool_call_start') {
          if (showingThink) { O('\r' + ' '.repeat(cols) + '\r'); showingThink = false; }
          stopStreamAnim();
          const tc = (chunk as any).tool_call;
          if (tc) curTc = { id: tc.id, name: tc.name, argsStr: '' };
        }
        if (chunk.type === 'tool_call_end' && curTc) {
          const tcData = (chunk as any).tool_call;
          try {
            const args = tcData?.arguments || JSON.parse(curTc.argsStr || '{}');
            tcs.push({ id: curTc.id, name: curTc.name, args });
          } catch { tcs.push({ id: curTc.id, name: curTc.name, args: {} }); }
          curTc = null;
        }
        if (chunk.type === 'done') break;
        if (chunk.type === 'error') { se = chunk.error || '?'; break; }
      }
    } catch (e: unknown) {
      stopStreamAnim();
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes('abort') || errMsg.includes('cancel')) {
        se = null;
        O(y('\n  ⚡ 请求已取消\n'));
      } else {
        se = errMsg;
      }
    }

    currentAbortController = null;
    stopStreamAnim();
    Oflush();
    const remaining = md.flush();
    if (remaining) O(remaining);
    md.reset();

    if (se) {
      ce++; O(r(`\n  ✗ ${se}`));
      if (ce >= 3) { O(r('\n  连续失败，放弃\n\n')); return; }
      const w = Math.min(1000 * ce, 5000); O(G(`  重试(${ce}/3)...\n`)); await new Promise(r2 => setTimeout(r2, w)); continue;
    }

    const el = Date.now() - st;
    if (fc && !tcs.length) O('\n');

    if (tcs.length > 0) {
      stagnation = 0;
      Oflush();
      const compactFc = fc && fc.length > 500 ? fc.replace(/\n/g, ' ').slice(0, 300) + '…' : fc;
      history.push({ role: 'assistant', content: compactFc || null, reasoning_content: th || undefined, tool_calls: tcs.map(t => ({ id: t.id, name: t.name, arguments: { ...t.args } })) });
      fc = ''; th = '';
      let doneTools = 0;

      if (iter === 0) {
        const tdSummary = todoSummary();
        if (tdSummary) { Oflush(); O('\n' + d(tdSummary.split('\n').join('\n  ')) + '\n'); }
      }

      const safe = tcs.filter(t => (TOOL_SAFETY_MAP[t.name] || 'safe') === 'safe');
      const rest = tcs.filter(t => (TOOL_SAFETY_MAP[t.name] || 'safe') !== 'safe');
      if (safe.length > 1) {
        const results = await Promise.allSettled(safe.map(async tc => { const r = await execTool(tc, tools, opts); doneTools++; return r; }));
        for (const r of results) {
          if (r.status === 'fulfilled') { history.push(r.value); ttc++; GS.tc++; }
          else { history.push({ role: 'tool', content: `Error: ${String(r.reason)}`, tool_call_id: 'parallel', name: 'parallel' }); }
        }
      } else if (safe.length === 1) {
        const r = await execTool(safe[0], tools, opts);
        history.push(r); ttc++; GS.tc++; doneTools++;
      }
      for (const tc of rest) {
        const r2 = await execTool(tc, tools, opts, confirm);
        history.push(r2); if (!r2.content?.startsWith('Error:') && !r2.content?.includes('skipped')) { ttc++; GS.tc++; }
        doneTools++;
      }
      tcs.length = 0; safe.length = 0; rest.length = 0;

      trimHistory(history, MAX_HISTORY); continue;
    }

    if (fc) { history.push({ role: 'assistant', content: fc, reasoning_content: th || undefined }); stagnation = 0; }
    else { stagnation++; }

    const ctxPct = ((totalCtx / CONTEXT_LIMIT) * 100).toFixed(1);
    const ctxWarn = totalCtx > CTX_WARN ? y(` ${ctxPct}%`) : G(` ${ctxPct}%`);
    O(G(`  ▸ ${(el / 1000).toFixed(1)}s · ${ttc} 工具 · 上下文${ctxWarn}`) + '\n\n');
    trimHistory(history, MAX_HISTORY);

    if (fc) {
      const lu = lastUser(history);
      xmemory.storeEpisodic(`完成任务: ${lu.slice(0, 100)} → ${fc.slice(0, 200)}`, ['task', 'complete'], 5);
      xmemory.storeSemantic(`学会了关于 ${lu.slice(0, 80)} 的处理方式`, ['learning'], 4);
    }

    return;
  }
}

async function execTool(
  tc: { id: string; name: string; args: Record<string, unknown> },
  tools: Tool[], opts: ReplOptions,
  confirm?: (msg: string) => Promise<boolean>,
): Promise<Message> {
  const tool = tools.find(t => t.name === tc.name);
  if (!tool) return { role: 'tool', content: `Error: unknown tool ${tc.name}`, tool_call_id: tc.id, name: tc.name };

  const vResult = validator.validate(tool, tc.args);
  if (!vResult.success) {
    return { role: 'tool', content: `Error: ${vResult.error}`, tool_call_id: tc.id, name: tc.name };
  }

  const s = TOOL_SAFETY_MAP[tc.name] || 'safe';
  const toolName = tc.name;
  const tSyms = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  let ti = 0;

  if ((s === 'dangerous' || s === 'confirm') && confirm) {
    Oflush(); O('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    const prefix = s === 'dangerous' ? '⛔' : '⚠';
    O(y(` ${prefix}确认? `));
    const ok = await confirm(`执行 ${toolName}?`);
    if (!ok) { O(G(' 跳过\n')); return { role: 'tool', content: 'User skipped', tool_call_id: tc.id, name: tc.name }; }
    O('\r' + A.d + '  ' + A.R + A.c + tSyms[0] + A.R + A.G + ' ' + toolName + A.R + '     ');
  }

  let execAnimIv: ReturnType<typeof setInterval> | null = null;
  const stopToolAnim = () => { if (execAnimIv) { clearInterval(execAnimIv); execAnimIv = null; } };
  try {
    const toolStart = Date.now();
    const rawWrite = (s: string) => { try { process.stdout.write(s); } catch {} };
    rawWrite('\r' + thinkingAnimAt(toolName, toolStart));
    execAnimIv = setInterval(() => { rawWrite('\r' + thinkingAnimAt(toolName, toolStart)); }, 80);

    const timeout = TOOL_TIMEOUT_MAP[tc.name] || DEFAULT_TOOL_TIMEOUT;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    if (tc.name === 'write_file' || tc.name === 'edit_file') {
      const fp = (tc.args.file_path || tc.args.path || tc.args.file || '') as string;
      if (fp) backupFile(fp);
    }

    let result: { success: boolean; error?: string; output?: string };
    try {
      result = await tool.execute(tc.args, ac.signal) as any;
      clearTimeout(timer);
    } catch (e: unknown) {
      clearTimeout(timer);
      result = { success: false, error: (e as Error).message, output: '' };
    }

    stopToolAnim();
    const rawResult = result.success ? result.output || '' : `Error: ${result.error || 'failed'}`;
    const text = result.success ? sanitize(rawResult).slice(0, TOOL_RESULT_MAX) : `Error: ${result.error || 'failed'}`;
    const showPath = (p: string) => p.split(/[/\\]/).filter(Boolean).slice(-2).join('/').slice(-35);

    let brief = '';
    if (tc.name === 'write_file' || tc.name === 'edit_file') {
      const fp = (tc.args.file_path || tc.args.path || tc.args.file || '') as string;
      brief = showPath(fp);
    } else if (tc.name === 'todo_manager') {
      brief = '任务已更新';
    } else {
      brief = rawResult.replace(/\n/g, ' ').slice(0, 60);
    }
    Oflush(); O('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    if (tc.name === 'todo_manager' && result.success) {
      O(A.y + A.b + '  ▸▸ █ 任务面板' + A.R + '\n');
      const lines = rawResult.split('\n').filter(Boolean);
      let shown = 0; const MAX_SHOW = 16;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^📋/.test(trimmed)) {
          O(A.b + '  ' + trimmed + A.R + '\n');
          continue;
        }
        shown++;
        if (shown > MAX_SHOW) { O(G('  …\n')); break; }
        const depth = line.match(/^(\s*)/)?.[1].length ?? 0;
        const colored = trimmed
          .replace(/^✓\s*/, g('✓ '))
          .replace(/^◉\s*/, y('◉ '))
          .replace(/^○\s*/, G('○ '))
          .replace(/^✗\s*/, r('✗ '));
        if (depth >= 4) O(G('    ') + colored + '\n');
        else if (depth >= 2) O(G('  ') + colored + '\n');
        else O('  ' + colored + '\n');
      }
      O('\n');
    } else {
      O(g(' ✓') + G(` ${c(tc.name)} ${brief}\n`));
    }
    if (result.success) {
      xmemory.storeWorking(`${tc.name}: ${brief}`, [tc.name, 'tool']);
      if (tc.name === 'write_file' || tc.name === 'edit_file' || tc.name === 'delete_file') {
        xmemory.storeEpisodic(`修改了文件: ${brief}`, ['file', 'modified'], 6);
      }
    }

    return { role: 'tool', content: text, tool_call_id: tc.id, name: tc.name };
  } catch (e: unknown) {
    stopToolAnim();
    const em = e instanceof Error ? e.message : String(e);
    Oflush(); O('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    O(r(' ✗') + G(` ${tc.name} ${em.slice(0, 60)}\n`));
    return { role: 'tool', content: `Error: ${em}`, tool_call_id: tc.id, name: tc.name };
  }
}

// ========== Helpers ==========

function buildMsgs(history: Message[]): Array<Record<string, unknown>> {
  const r: Array<Record<string, unknown>> = [];
  let sysContent = `You are DeeperCode V4-Pro, an elite full-stack AI coding agent with autonomous execution capability.

## Core Principles
1. READ BEFORE WRITE — Always inspect project state before making changes.
2. COMPLETE CODE — Write full files. Never use placeholders like "// ..." or "rest of code".
3. ONE CALL = ONE FILE — Each write_file contains exactly one complete file. Batch independent writes.
4. PLAN WITH TODOS — Use todo_manager for multi-step tasks. Update status as you progress.
5. ACT OVER EXPLAIN — Keep reasoning brief. Prefer tool calls over lengthy explanations.
6. VERIFY AFTER WRITE — After writing code, run type checks, linters, or tests to confirm correctness.
7. FIX ERRORS PROACTIVELY — If a tool returns an error, diagnose and fix it immediately.
8. PARALLEL WHEN POSSIBLE — Execute independent tool calls simultaneously for efficiency.

## Smart Editing Strategy
- For EXISTING files, prefer edit_file over write_file to minimize diff size.
- For NEW files, use write_file with complete content.
- Before editing, read the file first to understand its current state.
- Make targeted, minimal edits rather than rewriting entire files.

## Auto-Verification Loop
After writing or editing code files, ALWAYS verify the changes:
1. Run the project's build command (npm run build, tsc --noEmit, cargo check, etc.)
2. If build fails, read the error output, fix the issues, and re-verify
3. If tests exist, run them to confirm nothing is broken
4. Repeat until all checks pass — do NOT leave the user with broken code

## Error Recovery
- When a tool call fails, analyze the error message carefully before retrying
- If the same approach fails twice, try a different strategy
- For type errors: read the file, understand the types, fix precisely
- For runtime errors: add proper error handling and logging
- Never give up after one failure — adapt and overcome

## Execution Strategy
- Start by reading relevant files and understanding the codebase structure.
- Break complex tasks into small, verifiable steps.
- After each code change, verify it compiles/passes before moving on.
- When stuck, try a different approach rather than repeating the same failed action.
- Use subagent for independent subtasks that can run in parallel.

## Context
- cwd=${process.cwd()} plat=${process.platform} arch=${process.arch}
- Respond in the same language as the user's input.`;

  const ts = todoSummary(4);
  if (ts) sysContent += '\n[Remaining Tasks]\n' + ts;

  const lastU = history.filter(m => m.role === 'user').pop();
  if (lastU?.content) {
    const hints = xmemory.getProceduralHints(lastU.content || '', 3);
    if (hints) sysContent += '\n' + hints;
  }
  const workCtx = xmemory.getWorkingContext(400);
  if (workCtx) sysContent += '\n[Recent Work]\n' + workCtx;

  const skillPrompt = getSkillSystemPrompt();
  if (skillPrompt) sysContent += '\n' + skillPrompt;

  r.push({ role: 'system', content: sysContent });

  const deeperCtx = cachedRead(join(process.cwd(), 'deeper.md'));
  if (deeperCtx && deeperCtx.trim() && !deeperCtx.includes('<!-- 填写')) {
    r.push({ role: 'system', content: `[项目上下文 deeper.md]\n${deeperCtx}` });
  }
  const projRules = cachedRead(join(process.cwd(), '.deeper', 'rules.md'));
  if (projRules && projRules.trim()) r.push({ role: 'system', content: `[项目规则 rules.md]\n${projRules}` });
  const globalRules = cachedRead(join(DEEPER_HOME, 'rules.md'), 2000);
  if (globalRules && globalRules.trim()) r.push({ role: 'system', content: `[全局规则]\n${globalRules}` });

  for (const m of history.slice(-30)) {
    const e: Record<string, unknown> = { role: m.role };
    if (m.content != null) e.content = (m.content || '').slice(0, 8000);
    if (m.reasoning_content) e.reasoning_content = (String(m.reasoning_content)).slice(0, 2000);
    if (m.tool_calls) e.tool_calls = m.tool_calls.map(t => ({
      id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.arguments) },
    }));
    if (m.tool_call_id) e.tool_call_id = m.tool_call_id;
    if (m.role === 'tool') {
      e.name = m.name || 'tool';
    }
    r.push(e);
  }
  return r.map(m => { if (m.role === 'tool' && !m.name) m.name = 'tool'; return m; });
}

function trimHistory(h: Message[], max: number) { while (h.length > max) h.shift(); }

const _fileCache = new Map<string, { mtime: number; content: string }>();
function cachedRead(path: string, maxLen = 4000): string | null {
  if (!existsSync(path)) return null;
  try {
    const st = statSync(path);
    const cached = _fileCache.get(path);
    if (cached && cached.mtime === st.mtimeMs) return cached.content;
    const content = readFileSync(path, 'utf-8').slice(0, maxLen);
    _fileCache.set(path, { mtime: st.mtimeMs, content });
    return content;
  } catch { return null; }
}

function compressHistory(h: Message[]): void {
  if (h.length <= 6) return;
  const keep = 6;
  const old = h.slice(0, h.length - keep);
  const recent = h.slice(h.length - keep);

  const sections: string[] = [];
  let userParts: string[] = [];
  let assistantParts: string[] = [];
  let toolParts: string[] = [];

  const flushSection = () => {
    if (userParts.length > 0) sections.push(`[用户] ${userParts.join(' → ')}`);
    if (assistantParts.length > 0) sections.push(`[助手] ${assistantParts.join(' → ')}`);
    if (toolParts.length > 0) sections.push(`[工具] ${toolParts.join(', ')}`);
    userParts = []; assistantParts = []; toolParts = [];
  };

  for (const m of old) {
    if (m.role === 'system') {
      flushSection();
      continue;
    }
    if (m.role === 'user' && m.content) {
      if (assistantParts.length > 0 || toolParts.length > 0) flushSection();
      userParts.push(m.content.slice(0, 120));
    } else if (m.role === 'assistant') {
      if (m.tool_calls && m.tool_calls.length > 0) {
        const names = m.tool_calls.map(t => t.name).join(', ');
        toolParts.push(names);
      }
      if (m.content) {
        assistantParts.push(m.content.slice(0, 150));
      }
    } else if (m.role === 'tool' && m.content) {
      const isErr = m.content.startsWith('Error:');
      toolParts.push(isErr ? '❌' : '✓');
    }
  }
  flushSection();

  const compressed = sections.join('\n').slice(0, 4000);
  h.length = 0;
  h.push({ role: 'system', content: `[上下文压缩·${old.length}条摘要]\n${compressed}` });
  h.push(...recent);
}

function sanitize(t: string): string {
  return t.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\n{6,}/g, '\n\n');
}

function lastUser(h: Message[]): string { for (let i = h.length - 1; i >= 0; i--) if (h[i].role === 'user' && h[i].content) return h[i].content!; return ''; }

function computeSimpleDiff(oldText: string, newText: string, filePath: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);
  const result: string[] = [];
  let changeCount = 0;
  const contextLines = 3;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine !== newLine) {
      changeCount++;
      const start = Math.max(0, i - contextLines);
      const end = Math.min(maxLines, i + contextLines + 1);
      if (result.length === 0 || result[result.length - 1] !== '...') {
        result.push(G(`  @@ line ${i + 1} @@`));
      }
      for (let j = start; j < end; j++) {
        if (j === i) {
          if (oldLine !== undefined && newLine !== undefined) {
            result.push(r(`  - ${oldLines[j]}`));
            result.push(g(`  + ${newLines[j]}`));
          } else if (oldLine !== undefined) {
            result.push(r(`  - ${oldLines[j]}`));
          } else {
            result.push(g(`  + ${newLines[j]}`));
          }
        } else if (j < oldLines.length && j < newLines.length) {
          result.push(G(`    ${oldLines[j]}`));
        }
      }
      result.push(G('  ...'));
    }
  }

  if (changeCount === 0) return G('  (无变更)');
  const rel = relative(process.cwd(), filePath);
  return `${G(`文件: ${rel} (${changeCount} 处变更)`)}\n${result.join('\n')}`;
}

function toolsToDefs(tools: Tool[]): ToolDef[] {
  return tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters as unknown as Record<string, unknown> } }));
}

// ========== Session commands ==========

async function saveSession(history: Message[], name?: string) {
  const label = name || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(SESSION_DIR, `sess_${label}.json`);
  writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), cwd: process.cwd(), messages: history }, null, 2), 'utf-8');
  O(g(`已保存: sess_${label}`) + '\n\n');
}

async function listSessions() {
  if (!existsSync(SESSION_DIR)) { O(r('无保存的会话\n\n')); return; }
  const files = readdirSync(SESSION_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().reverse();
  if (!files.length) { O(r('无保存的会话\n\n')); return; }
  O(b(c('  Sessions')) + G(` · ${files.length} 个`) + '\n');
  for (let i = 0; i < Math.min(files.length, 15); i++) {
    const f = files[i];
    try {
      const data = JSON.parse(readFileSync(join(SESSION_DIR, f), 'utf-8'));
      const label = f.replace(/^sess_|\.json$/g, '');
      const msgCount = data.messages?.length || 0;
      const savedAt = data.savedAt?.slice(0, 16) || '?';
      O(G(`  ${i + 1}. `) + c(label) + G(` · ${msgCount}条 · ${savedAt}`) + '\n');
    } catch { O(G(`  ${i + 1}. ${f} (损坏)\n`)); }
  }
  O('\n  加载: /load <name> | 恢复: /resume\n\n');
}

async function loadNamedSession(history: Message[], name: string) {
  const file = join(SESSION_DIR, `sess_${name}.json`);
  if (!existsSync(file)) { O(r(`会话不存在: ${name}\n\n`)); return; }
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  history.push({ role: 'system', content: `[已加载: ${name} (${data.messages?.length || 0} 条)]` });
  if (data.messages) for (const m of data.messages) {
    if (m.role === 'tool' && !m.name) m.name = 'tool';
    history.push(m);
  }
  trimHistory(history, MAX_HISTORY);
  O(g(`已加载: ${name}`) + '\n\n');
}

async function loadLatestSession(history: Message[]) {
  if (!existsSync(SESSION_DIR)) { O(r('无保存的会话\n\n')); return; }
  const files = readdirSync(SESSION_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().reverse();
  if (!files.length) { O(r('无保存的会话\n\n')); return; }
  const file = join(SESSION_DIR, files[0]);
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const label = files[0].replace(/^sess_|\.json$/g, '');
  history.push({ role: 'system', content: `[已加载: ${label} (${data.messages?.length || 0} 条)]` });
  if (data.messages) for (const m of data.messages) {
    if (m.role === 'tool' && !m.name) m.name = 'tool';
    history.push(m);
  }
  trimHistory(history, MAX_HISTORY);
  O(g(`已加载: ${label}`) + '\n\n');
}

async function exportHistory(history: Message[]) {
  const file = join(process.cwd(), `deeper-export-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(history, null, 2), 'utf-8');
  O(g(`已导出: ${file}`) + '\n\n');
}

async function initProject(): Promise<void> {
  const file = join(process.cwd(), 'deeper.md');
  if (existsSync(file)) {
    O(y('  deeper.md 已存在，跳过\n\n'));
    return;
  }
  const content = `# DeeperCode 项目上下文

> 此文件由 \`/init\` 自动生成，AI 会在每次对话中自动读取。
> 你可以手动编辑，添加项目规则、约定和背景信息。

## 📁 项目名称

<!-- 填写项目名称 -->

## 🎯 项目目标

<!-- 简要描述项目目的 -->

## 🛠 技术栈

<!-- 例如: React + TypeScript + Vite -->

## 📐 代码规范

<!-- 命名约定、文件组织等 -->

## ⚙️ 常用命令

<!-- npm run dev, npm test 等 -->

## 📝 注意事项

<!-- AI 需要注意的任何特殊要求 -->

---

*最后更新: ${new Date().toISOString()}*
`;
  writeFileSync(file, content, 'utf-8');
  O(g('已创建: deeper.md') + G(' (可编辑后 AI 自动读取)') + '\n\n');
}

// ========== Display commands ==========

async function showTasks(): Promise<void> {
  const items = getTodos();
  if (items.length === 0) { O(G('  任务列表为空\n\n')); return; }
  let total = 0, done = 0;
  for (const t of items) {
    total++; if (t.status === 'done') done++;
    if (t.subtasks) for (const st of t.subtasks) { total++; if (st.status === 'done') done++; }
  }
  O(b(c('  Tasks')) + G(` · ${done}/${total}`) + '\n');
  let shown = 0; const MAX = 15;
  for (const t of items) {
    if (++shown > MAX) { O(G('  …\n')); break; }
    const s = t.status === 'done' ? g('✓') : t.status === 'in_progress' ? y('◉') : t.status === 'cancelled' ? r('✗') : G('○');
    const plan = t.plan ? G(` → ${t.plan.slice(0, 30)}`) : '';
    O(`  ${s} ${t.title.slice(0, 50)}${plan}\n`);
    if (t.subtasks) for (const st of t.subtasks) {
      const ss = st.status === 'done' ? g('  ✓') : G('  ○');
      O(`  ${ss} ${st.title.slice(0, 40)}\n`);
    }
  }
  O('\n');
}

async function showMemory(): Promise<void> {
  const total = xmemory.totalEntries;
  const types = {
    semantic: xmemory.getByType('semantic', 3),
    procedural: xmemory.getByType('procedural', 3),
    episodic: xmemory.getByType('episodic', 3),
    working: xmemory.getWorking().slice(-3),
  };
  O(b(c('  XMemory')) + G(` · ${total} 条记忆`) + '\n');
  for (const [t, entries] of Object.entries(types)) {
    if (entries.length === 0) continue;
    const label = t === 'semantic' ? '知识' : t === 'procedural' ? '技能' : t === 'episodic' ? '经历' : '工作';
    O(G(`  [${label}]\n`));
    for (const e of entries) { O(G(`    ${e.content.slice(0, 120)}`) + '\n'); }
  }
  O('\n');
}

async function showToolsBrief(tools: Tool[]): Promise<void> {
  const cats = [...new Set(tools.map(t => t.category))];
  for (const cat of cats.slice(0, 8)) {
    const ns = tools.filter(t => t.category === cat).map(t => t.name);
    O(B(`${cat}: `) + ns.join(', ') + '\n');
  }
  O(c(`\n  /tools <category> 查看分类详情 (共 ${cats.length} 个分类)\n\n`));
}

async function showToolsOf(cat: string, tools: Tool[]): Promise<void> {
  const filtered = tools.filter(t => t.category === cat);
  if (!filtered.length) { O(r(`分类不存在: ${cat}\n\n`)); return; }
  O(b(c(`  ${cat}`)) + '\n');
  for (const t of filtered) {
    const safe = TOOL_SAFETY_MAP[t.name] === 'dangerous' ? r('⚠') : TOOL_SAFETY_MAP[t.name] === 'confirm' ? y('?') : g('✓');
    O(`  ${safe} ${c(t.name)} ${G(t.description.slice(0, 50))}\n`);
  }
  O('\n');
}

async function loadBuiltinTools(): Promise<Tool[]> {
  const { builtinTools } = await import('../tools/builtin/index.js');
  return builtinTools as Tool[];
}

// ========== API (uses DeepSeekClient, no double retry) ==========

async function callApi(
  opts: ReplOptions, msgs: Array<Record<string, unknown>>,
  tools: ToolDef[], cmt = 8192, signal?: AbortSignal,
): Promise<AsyncIterable<StreamChunk>> {
  const client = new DeepSeekClient({
    apiKey: opts.apiKey || '',
    model: opts.model || 'deepseek-chat',
    baseUrl: opts.baseUrl || 'https://api.deepseek.com',
    temperature: opts.temperature ?? 0,
    maxTokens: cmt,
    think: { enabled: opts.thinkEnabled ?? true, budgetTokens: Math.min(cmt, opts.thinkBudget || 16000) },
    signal,
  });
  const chatMsgs: ChatMessage[] = msgs.map(m => ({
    role: (m.role as ChatMessage['role']) || 'user',
    content: m.content != null ? String(m.content) : null,
    tool_calls: m.tool_calls as ChatMessage['tool_calls'],
    tool_call_id: m.tool_call_id as string | undefined,
    name: m.name as string | undefined,
    reasoning_content: m.reasoning_content as string | undefined,
  }));

  for (let i = 0; i < chatMsgs.length; i++) {
    const m = chatMsgs[i];
    if (m.role === 'tool' && !m.name) {
      m.name = m.tool_call_id || 'tool';
    }
  }
  const stream = await client.chatStream(chatMsgs, tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    category: '',
    parameters: t.function.parameters as unknown as import('../tools/tool-types.js').JSONSchema,
  })));
  return stream;
}
