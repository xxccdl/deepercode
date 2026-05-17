import readline from 'node:readline';
import process from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
let GS = { tc: 0, api: 0, ch: 0 };
let skillEngine: SkillEngine | null = null;
let mcpClient: MCPClient | null = null;
const validator = new ToolValidator();

function getSkillSystemPrompt(): string {
  if (!skillEngine) return '';
  return skillEngine.getSystemPrompt();
}

export async function startRepl(opts: ReplOptions): Promise<void> {
  const tools = await loadBuiltinTools();
  const toolDefs = toolsToDefs(tools);

  // 连接 subagent 工具到真正的子代理执行引擎
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
          const stream = await callApi(opts, msgs, tds, 0, 131072); GS.api++; ce = 0;
          for await (const chunk of stream) {
            if (chunk.type === 'text') { fc += chunk.content || ''; }
            if (chunk.type === 'thinking') th += chunk.content || '';
            if (chunk.type === 'tool_call_start') { const tc = (chunk as any).tool_call; if (tc) curTc = { id: tc.id, name: tc.name, argsStr: '' }; }
            if (chunk.type === 'tool_call_args' && curTc) curTc.argsStr += (chunk as any).content || '';
            if (chunk.type === 'tool_call_end' && curTc) {
              try { tcs.push({ id: curTc.id, name: curTc.name, args: JSON.parse(curTc.argsStr || '{}') }); } catch { tcs.push({ id: curTc.id, name: curTc.name, args: {} }); }
              curTc = null;
            }
            if (chunk.type === 'done') break;
            if (chunk.type === 'error') { se = chunk.error || '?'; break; }
          }
        } catch (e: unknown) { se = e instanceof Error ? e.message : String(e); }

        if (se) { ce++; stag++; if (ce >= 2) return `子代理失败: ${se}`; await new Promise(r2 => setTimeout(r2, 1000)); continue; }

        if (tcs.length > 0) {
          stag = 0;
          lh.push({ role: 'assistant', content: fc || null, reasoning_content: undefined as string | undefined, tool_calls: tcs.map(t => ({ id: t.id, name: t.name, arguments: { ...t.args } })) });
          for (const tc of tcs) {
            const tool = tools.find(t => t.name === tc.name);
            if (!tool) { lh.push({ role: 'tool', content: `Error: unknown ${tc.name}`, tool_call_id: tc.id }); continue; }
            const s2 = TOOL_SAFETY_MAP[tc.name] || 'safe';
            if (s2 === 'dangerous') { lh.push({ role: 'tool', content: 'Skipped', tool_call_id: tc.id }); continue; }
            try {
              const r = await tool.execute(tc.args, new AbortController().signal);
              const txt = sanitize(r.output || '').slice(0, TOOL_RESULT_MAX);
              lh.push({ role: 'tool', content: r.success ? txt : `Error: ${(r as any).error}`, tool_call_id: tc.id });
              GS.tc++;
            } catch (e: unknown) { lh.push({ role: 'tool', content: `Error: ${e instanceof Error ? e.message : String(e)}`, tool_call_id: tc.id }); }
          }
          trimHistory(lh, 20); continue;
        }
        // 无工具调用但有文本 → 完成
        if (fc) { lh.push({ role: 'assistant', content: fc }); stag = 0; }
        else { stag++; if (stag >= 3) return `停滞: 连续${stag}轮无进展`; continue; }
        const final = lh[lh.length-1]?.content || '完成';
        return final.slice(0, 800);
      }
    };

    if (isBg) {
      run().then(result => {
        history.push({ role: 'system', content: `[子代理] ${task.slice(0,50)} → ${result.slice(0, 300)}` });
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

  // 加载 Skills
  skillEngine = new SkillEngine();
  let skillCount = 0;
  try {
    skillCount = await skillEngine.loadAll();
  } catch { /* skills optional */ }

  // 连接 MCP 服务器
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
  process.stdout.on('resize', () => {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => { resizeTimer = null; Oflush(); }, 200);
  });

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

  rl.on('SIGINT', () => {
    if (resolveLine) { const cb = resolveLine; resolveLine = null; cb('/quit'); return; }
    Oflush();
    xmemory.save().then(() => { O('\n' + y('再见！') + '\n'); running = false; rl.close(); process.exit(0); });
  });
  process.on('uncaughtException', (err) => { if (!err.message?.includes('readline')) O(r(`\n  ⚠ ${err.message}`) + '\n'); });
  process.on('unhandledRejection', (reason: unknown) => { const m = reason instanceof Error ? reason.message : String(reason); if (!m.includes('readline') && !m.includes('Abort') && !m.includes('timeout')) O(r(`\n  ⚠ ${m}`) + '\n'); });

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
        O(G('  /status') + G('    当前状态') + '\n');
        O(G('  /model') + G('     模型设置') + '\n');
        O(G('  /config') + G('    配置管理') + '\n');
        O(G('  /cwd') + G('       当前目录') + '\n');
        O(G('  /export') + G('    导出对话') + '\n');
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
        O(c('  /tools [cat] /stats /memory /tasks /model /config /cwd /export /init /mcp /rules\n\n'));
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
    // 上下文接近上限 → 降 tokens 而不是直接退出
    const ctxTokens = estimateTokens(history.map(m => m.content || '').join('\n'));
    const toolsTokenOverhead = toolDefs.length * 80;
    const totalCtx = ctxTokens + toolsTokenOverhead;
    const nearLimit = totalCtx > CONTEXT_LIMIT * 0.95;
    // 上下文自动压缩：超过 70% 时压缩旧消息
    if (totalCtx > CONTEXT_LIMIT * 0.7 && history.length > 10) {
      compressHistory(history);
    }
    // 连续空转检测
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

    // 思考动画：API 等待和推理期间持续显示
    resetTimer();
    const animLabel = () => showingThink ? '思考中' : '解析中';
    const animTick = () => { O('\r' + thinkingAnim(animLabel())); };
    let thinkAnimIv: ReturnType<typeof setInterval> | null = null;
    animTick(); // 首帧立即渲染，不等 100ms
    thinkAnimIv = setInterval(animTick, 80);
    const md = new MarkdownStreamRenderer();

    const startStreamAnim = () => {
      if (thinkAnimIv) return;
      resetTimer();
      animTick(); // 首帧立即渲染
      thinkAnimIv = setInterval(animTick, 80);
    };
    const stopStreamAnim = () => {
      if (thinkAnimIv) { clearInterval(thinkAnimIv); thinkAnimIv = null; }
    };

    try {
      const stream = await callApi(opts, msgs, toolDefs, 0, amax);
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
            if (!fc.slice(t.length - t.length)) O(b(c('●')) + ' ');
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
        if (chunk.type === 'tool_call_args' && curTc) curTc.argsStr += (chunk as any).content || '';
        if (chunk.type === 'tool_call_end' && curTc) {
          try { tcs.push({ id: curTc.id, name: curTc.name, args: JSON.parse(curTc.argsStr || '{}') }); } catch { tcs.push({ id: curTc.id, name: curTc.name, args: {} }); }
          curTc = null;
        }
        if (chunk.type === 'done') break;
        if (chunk.type === 'error') { se = chunk.error || '?'; break; }
      }
    } catch (e: unknown) { stopStreamAnim(); se = e instanceof Error ? e.message : String(e); }

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
      history.push({ role: 'assistant', content: compactFc || null, reasoning_content: undefined, tool_calls: tcs.map(t => ({ id: t.id, name: t.name, arguments: { ...t.args } })) });
      fc = ''; th = '';
      let doneTools = 0;

      // 只在第一轮显示完整任务面板
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
          else { history.push({ role: 'tool', content: `Error: ${String(r.reason)}`, tool_call_id: 'parallel' }); }
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
      // 释放 tcs 引用帮助 GC
      tcs.length = 0; safe.length = 0; rest.length = 0;

      trimHistory(history, MAX_HISTORY); continue;
    }

    if (fc) { history.push({ role: 'assistant', content: fc }); stagnation = 0; }
    else { stagnation++; }

    const ctxPct = ((totalCtx / CONTEXT_LIMIT) * 100).toFixed(1);
    const ctxWarn = totalCtx > CTX_WARN ? y(` ${ctxPct}%`) : G(` ${ctxPct}%`);
    O(G(`  ▸ ${(el/1000).toFixed(1)}s · ${ttc} 工具 · 上下文${ctxWarn}`) + '\n\n');
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
  if (!tool) return { role: 'tool', content: `Error: unknown tool ${tc.name}`, tool_call_id: tc.id };

  const vResult = validator.validate(tool, tc.args);
  if (!vResult.success) {
    return { role: 'tool', content: `Error: ${vResult.error}`, tool_call_id: tc.id };
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
    if (!ok) { O(G(' 跳过\n')); return { role: 'tool', content: 'User skipped', tool_call_id: tc.id }; }
    O('\r' + A.d + '  ' + A.R + A.c + tSyms[0] + A.R + A.G + ' ' + toolName + A.R + '     ');
  }

  let execAnimIv: ReturnType<typeof setInterval> | null = null;
  const stopToolAnim = () => { if (execAnimIv) { clearInterval(execAnimIv); execAnimIv = null; } };
  try {
    const toolStart = Date.now();
    const rawWrite = (s: string) => { try { process.stdout.write(s); } catch {} };
    rawWrite('\r' + thinkingAnimAt(toolName, toolStart));
    execAnimIv = setInterval(() => { rawWrite('\r' + thinkingAnimAt(toolName, toolStart)); }, 80);
    const execed = Promise.race([
      tool.execute(tc.args, new AbortController().signal),
      new Promise<{ success: false; error: string; output: string }>((_, rej) => setTimeout(() => rej(new Error('工具超时 (30s)')), 30_000)),
    ]);
    let result: { success: boolean; error?: string; output?: string };
    try { result = await execed as any; } catch (e: unknown) { result = { success: false, error: (e as Error).message, output: '' }; }
    stopToolAnim();
    const rawResult = result.success ? result.output || '' : `Error: ${result.error || 'failed'}`;
    // 截断超大结果防 OOM
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

    return { role: 'tool', content: text, tool_call_id: tc.id };
  } catch (e: unknown) {
    stopToolAnim();
    const em = e instanceof Error ? e.message : String(e);
    Oflush(); O('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    O(r(' ✗') + G(` ${tc.name} ${em.slice(0, 60)}\n`));
    return { role: 'tool', content: `Error: ${em}`, tool_call_id: tc.id };
  }
}

// ========== Helpers ==========

function buildMsgs(history: Message[]): Array<Record<string, unknown>> {
  const r: Array<Record<string, unknown>> = [];
  let sysContent = `You are DeeperCode V4-Pro, a full-stack coding agent.
Rules:
1. Read before write. Use tools to inspect project state first.
2. Write COMPLETE files. No placeholders like "// ..." or "rest of code".
3. One write_file = one complete file. Batch independent writes.
4. Use todo_manager for multi-step tasks. Update status as you progress.
5. Keep reasoning brief. Prefer action over explanation.
6. cwd=${process.cwd()} plat=${process.platform}
7. Respond in Chinese when user uses Chinese.`;

  const ts = todoSummary(4);
  if (ts) sysContent += '\n[Remaining]\n' + ts;

  const lastU = history.filter(m => m.role === 'user').pop();
  if (lastU?.content) {
    const hints = xmemory.getProceduralHints(lastU.content || '', 3);
    if (hints) sysContent += '\n' + hints;
  }
  const workCtx = xmemory.getWorkingContext(400);
  if (workCtx) sysContent += '\n[最近工作]\n' + workCtx;

  const skillPrompt = getSkillSystemPrompt();
  if (skillPrompt) sysContent += '\n' + skillPrompt;

  r.push({ role: 'system', content: sysContent });

  // 自动注入 deeper.md 项目上下文 + rules 规则
  try {
    const deeperMd = join(process.cwd(), 'deeper.md');
    if (existsSync(deeperMd)) {
      const ctx = readFileSync(deeperMd, 'utf-8').slice(0, 4000);
      if (ctx.trim() && !ctx.includes('<!-- 填写')) {
        r.push({ role: 'system', content: `[项目上下文 deeper.md]\n${ctx}` });
      }
    }
  } catch { /* skip */ }
  try {
    const rulesFile = join(process.cwd(), '.deeper', 'rules.md');
    if (existsSync(rulesFile)) {
      const rules = readFileSync(rulesFile, 'utf-8').slice(0, 4000);
      if (rules.trim()) r.push({ role: 'system', content: `[项目规则 rules.md]\n${rules}` });
    }
  } catch { /* skip */ }
  try {
    const globalRules = join(DEEPER_HOME, 'rules.md');
    if (existsSync(globalRules)) {
      const rules = readFileSync(globalRules, 'utf-8').slice(0, 2000);
      if (rules.trim()) r.push({ role: 'system', content: `[全局规则]\n${rules}` });
    }
  } catch { /* skip */ }

  for (const m of history.slice(-30)) {
    const e: Record<string, unknown> = { role: m.role };
    // 截断大型消息防止 OOM
    if (m.content != null) e.content = (m.content || '').slice(0, 8000);
    if (m.reasoning_content) e.reasoning_content = (m.reasoning_content || '').slice(0, 2000);
    if (m.tool_calls) e.tool_calls = m.tool_calls.map(t => ({
      id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.arguments) },
    }));
    if (m.tool_call_id) e.tool_call_id = m.tool_call_id;
    r.push(e);
  }
  return r;
}

function trimHistory(h: Message[], max: number) { while (h.length > max) h.shift(); }

function compressHistory(h: Message[]): void {
  if (h.length <= 6) return;
  const keep = 6;
  const old = h.slice(0, h.length - keep);
  const recent = h.slice(h.length - keep);
  let compressed = '';
  for (const m of old) {
    if (m.role === 'user' && m.content) {
      compressed += `[用户] ${m.content.slice(0, 100)}\n`;
    } else if (m.role === 'assistant' && m.content) {
      compressed += `[助手] ${m.content.slice(0, 150)}\n`;
    } else if (m.role === 'tool' && m.content) {
      compressed += `[工具] ${m.content.slice(0, 80)}\n`;
    }
  }
  h.length = 0;
  h.push({ role: 'system', content: `[上下文压缩·${old.length}条摘要]\n${compressed.slice(0, 3000)}` });
  h.push(...recent);
}

function sanitize(t: string): string {
  return t.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\n{6,}/g, '\n\n');
}

function lastUser(h: Message[]): string { for (let i = h.length-1; i>=0; i--) if (h[i].role==='user' && h[i].content) return h[i].content!; return ''; }

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
      const cwd = data.cwd || '?';
      const savedAt = data.savedAt?.slice(0, 16) || '?';
      O(G(`  ${i+1}. `) + c(label) + G(` · ${msgCount}条 · ${savedAt}`) + '\n');
    } catch { O(G(`  ${i+1}. ${f} (损坏)\n`)); }
  }
  O('\n  加载: /load <name> | 恢复: /resume\n\n');
}

async function loadNamedSession(history: Message[], name: string) {
  const file = join(SESSION_DIR, `sess_${name}.json`);
  if (!existsSync(file)) { O(r(`会话不存在: ${name}\n\n`)); return; }
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  history.push({ role: 'system', content: `[已加载: ${name} (${data.messages?.length||0} 条)]` });
  if (data.messages) for (const m of data.messages) history.push(m);
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
  history.push({ role: 'system', content: `[已加载: ${label} (${data.messages?.length||0} 条)]` });
  if (data.messages) for (const m of data.messages) history.push(m);
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
    const plan = t.plan ? G(` → ${t.plan.slice(0,30)}`) : '';
    O(`  ${s} ${t.title.slice(0,50)}${plan}\n`);
    if (t.subtasks) for (const st of t.subtasks) {
      const ss = st.status === 'done' ? g('  ✓') : G('  ○');
      O(`  ${ss} ${st.title.slice(0,40)}\n`);
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

// ========== API ==========

interface StreamChunk {
  type: 'text'|'thinking'|'tool_call_start'|'tool_call_args'|'tool_call_end'|'done'|'error';
  content?: string; tool_call?: { id: string; name: string }; error?: string;
}

async function callApi(opts: ReplOptions, msgs: Array<Record<string, unknown>>, tools: ToolDef[], retry = 0, cmt = 8192): Promise<AsyncIterable<StreamChunk>> {
  const MR = 2, TO = 90_000;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TO);
  try {
    const resp = await fetch(`${opts.baseUrl}/v1/chat/completions`, {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        messages: msgs,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        stream: true,
        max_tokens: cmt,
        temperature: opts.temperature,
      }),
    });
    if (!resp.ok) {
      const et = await resp.text().catch(() => '');
      if (resp.status === 401) throw new Error('API Key 无效: deeper config set api_key "sk-xxx"');
      if ((resp.status === 429 || resp.status >= 500) && retry < MR) { const d = Math.min(1000*(retry+1),5000); await new Promise(r2 => setTimeout(r2, d)); return callApi(opts, msgs, tools, retry+1, cmt); }
      throw new Error(`HTTP ${resp.status}: ${et.slice(0,200)}`);
    }
    if (!resp.body) throw new Error('空响应');
    return sseIter(resp.body);
  } catch (e: unknown) {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if ((m.includes('timeout')||m.includes('abort')||m.includes('econn')) && retry < MR) { const d = Math.min(1000*(retry+1),5000); await new Promise(r2 => setTimeout(r2, d)); return callApi(opts, msgs, tools, retry+1, cmt); }
    throw e;
  } finally { clearTimeout(t); }
}

async function* sseIter(body: ReadableStream<Uint8Array>): AsyncIterable<StreamChunk> {
  const reader = body.getReader(); const dec = new TextDecoder(); let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.length > 65536) buf = buf.slice(-32768);
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        const tr = line.trim(); if (!tr || tr.startsWith(':')) continue; if (!tr.startsWith('data: ')) continue;
        const d = tr.slice(6).trim(); if (d === '[DONE]') { yield { type: 'done' }; return; }
        try {
          const p = JSON.parse(d); const ch = p.choices?.[0]; if (!ch) continue;
          const dl = ch.delta;
          if (dl?.content) yield { type: 'text', content: dl.content };
          if (dl?.reasoning_content) yield { type: 'thinking', content: dl.reasoning_content };
          if (dl?.tool_calls) for (const tc of dl.tool_calls) {
            if (tc.id) yield { type: 'tool_call_start', tool_call: { id: tc.id, name: tc.function?.name || '' } };
            if (tc.function?.arguments) yield { type: 'tool_call_args', content: tc.function.arguments };
            if (tc.id && tc.function?.arguments) yield { type: 'tool_call_end' };
          }
          if (ch.finish_reason === 'tool_calls') yield { type: 'tool_call_end' };
        } catch { /* skip */ }
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') { /* ok */ }
    else yield { type: 'error', error: e instanceof Error ? e.message : String(e) };
  } finally { try { reader.releaseLock(); } catch { /* */ } }
  yield { type: 'done' };
}
