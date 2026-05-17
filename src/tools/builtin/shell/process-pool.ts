import { spawn, type ChildProcess } from 'node:child_process';

export interface ProcessEntry {
  proc: ChildProcess;
  output: string;
  startTime: number;
  command: string;
  cwd: string;
  alive: boolean;
}

const pool = new Map<string, ProcessEntry>();
const RING_SIZE = 64_000;
const TAIL_SIZE = 16_000;

export function decodeBuffer(bufs: Buffer[]): string {
  const buf = Buffer.concat(bufs);
  if (process.platform === 'win32') {
    try {
      const decoder = new TextDecoder('gbk', { fatal: false });
      return decoder.decode(buf);
    } catch {
      return buf.toString('utf-8');
    }
  }
  return buf.toString('utf-8');
}

function ringPush(entry: ProcessEntry, chunk: string): void {
  entry.output += chunk;
  if (entry.output.length > RING_SIZE) {
    entry.output = entry.output.slice(-RING_SIZE);
  }
}

export function startBgProcess(params: {
  command: string;
  cwd?: string;
  terminalId?: string;
  env?: Record<string, string>;
}): { terminalId: string; pid: number | undefined } {
  const cwd = params.cwd || process.cwd();
  const terminalId = params.terminalId || `bg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const [cmd, ...args] = params.command.split(/\s+/);

  if (pool.has(terminalId)) {
    const old = pool.get(terminalId)!;
    try { old.proc.kill(); } catch {}
    pool.delete(terminalId);
  }

  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: params.env ? { ...process.env, ...params.env } : process.env,
  });

  const entry: ProcessEntry = {
    proc,
    output: '',
    startTime: Date.now(),
    command: params.command,
    cwd,
    alive: true,
  };

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  proc.stdout?.on('data', (d: Buffer) => stdoutChunks.push(d));
  proc.stderr?.on('data', (d: Buffer) => stderrChunks.push(d));

  const flushInterval = setInterval(() => {
    if (stdoutChunks.length > 0) {
      ringPush(entry, decodeBuffer(stdoutChunks.splice(0)));
    }
    if (stderrChunks.length > 0) {
      ringPush(entry, '[stderr] ' + decodeBuffer(stderrChunks.splice(0)));
    }
  }, 50);

  proc.on('close', (code) => {
    clearInterval(flushInterval);
    if (stdoutChunks.length > 0) ringPush(entry, decodeBuffer(stdoutChunks.splice(0)));
    if (stderrChunks.length > 0) ringPush(entry, '[stderr] ' + decodeBuffer(stderrChunks.splice(0)));
    entry.alive = false;
    ringPush(entry, `\n[进程结束, exitCode=${code}]\n`);
  });

  proc.on('error', (err) => {
    clearInterval(flushInterval);
    entry.alive = false;
    ringPush(entry, `\n[进程错误: ${err.message}]\n`);
  });

  pool.set(terminalId, entry);
  return { terminalId, pid: proc.pid ?? undefined };
}

export function readOutput(terminalId: string, tailOnly?: boolean): string | null {
  const entry = pool.get(terminalId);
  if (!entry) return null;
  const full = entry.output || '(暂无输出)';
  if (tailOnly) {
    return full.length > TAIL_SIZE ? '...(截断)\n' + full.slice(-TAIL_SIZE) : full;
  }
  return full.length > TAIL_SIZE * 2 ? full.slice(-TAIL_SIZE * 2) : full;
}

export function listProcesses(): Array<{
  id: string; pid: number | undefined; command: string;
  alive: boolean; runningSec: number; outputLen: number; outputTail: string;
}> {
  return Array.from(pool.entries()).map(([id, e]) => ({
    id,
    pid: e.proc.pid ?? undefined,
    command: e.command.slice(0, 60),
    alive: e.alive,
    runningSec: Math.round((Date.now() - e.startTime) / 1000),
    outputLen: e.output.length,
    outputTail: e.output.slice(-200).replace(/\n/g, '↵').slice(0, 160),
  }));
}

export function killProcess(terminalId: string): boolean {
  const entry = pool.get(terminalId);
  if (!entry) return false;
  try { entry.proc.kill('SIGKILL'); } catch {}
  pool.delete(terminalId);
  return true;
}

export function getProcess(terminalId: string): ProcessEntry | undefined {
  return pool.get(terminalId);
}

export function sendToStdin(terminalId: string, text: string): boolean {
  const entry = pool.get(terminalId);
  if (!entry || !entry.alive || !entry.proc.stdin) return false;
  entry.proc.stdin.write(text + '\n');
  return true;
}

export function sendSignal(terminalId: string, signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL'): boolean {
  const entry = pool.get(terminalId);
  if (!entry || !entry.alive) return false;
  try { entry.proc.kill(signal); } catch { return false; }
  return true;
}
