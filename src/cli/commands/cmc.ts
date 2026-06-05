import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEEPER_HOME } from '../../core/constants.js';
import { getConfig, updateConfig, type MCPConfigEntry } from '../../core/config.js';

const BIN_DIR = join(DEEPER_HOME, 'bin');
const MCP_DIR = join(DEEPER_HOME, 'mcp_servers', 'windows-mcp');
const PY_DIR = join(DEEPER_HOME, 'python313');
const SERVER_NAME = 'windows-mcp';

function log(msg: string) { console.log(`  ${msg}`); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function err(msg: string) { console.error(`  ❌ ${msg}`); }
function ensureDir(dir: string) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function robocopySafe(src: string, dst: string) {
  try { execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { timeout: 600_000, stdio: 'pipe' }); }
  catch (e: any) { if (e.status > 3) throw e; }
}

function robocopyExclude(src: string, dst: string, exclude: string[]) {
  const xd = exclude.map(d => `/XD "${d}"`).join(' ');
  try { execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /nc /ns /np ${xd}`, { timeout: 600_000, stdio: 'pipe' }); }
  catch (e: any) { if (e.status > 3) throw e; }
}

function getVendorDir(): string {
  try {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor');
    if (existsSync(join(dir, '.ready'))) return dir;
  } catch {}
  const fallback = resolve(process.cwd(), 'vendor');
  if (existsSync(join(fallback, '.ready'))) return fallback;
  return '';
}

function rebuildVenv() {
  const uvExe = join(BIN_DIR, 'uv.exe');
  const pyExe = join(PY_DIR, 'python.exe');
  if (!existsSync(uvExe) || !existsSync(pyExe)) return false;
  log('重建 .venv (uv sync, 首次需网络)...');
  try {
    execSync(`"${uvExe}" sync --python "${pyExe}"`, { cwd: MCP_DIR, encoding: 'utf-8', timeout: 600_000, stdio: 'pipe' });
    ok('.venv 已就绪');
    return true;
  } catch (e: any) {
    err(`uv sync 失败: ${e.message.slice(0, 100)}`);
    return false;
  }
}

function verifyMcpWorks(): boolean {
  const pythonExe = join(MCP_DIR, '.venv', 'Scripts', 'python.exe');
  if (!existsSync(pythonExe)) return false;
  try {
    const result = spawnSync(pythonExe, ['-c', 'import windows_mcp; print("OK")'], {
      cwd: MCP_DIR,
      timeout: 30000,
      encoding: 'utf-8',
    });
    if (result.error) {
      err(`Python 启动失败: ${result.error.message}`);
      return false;
    }
    ok('MCP 服务器可正常启动');
    return true;
  } catch (e: any) {
    err(`MCP 验证失败: ${e.message.slice(0, 80)}`);
    return false;
  }
}

function setupFromVendor(vendorDir: string): boolean {
  ensureDir(BIN_DIR);
  ensureDir(join(DEEPER_HOME, 'mcp_servers'));
  ensureDir(PY_DIR);

  const uvExe = join(BIN_DIR, 'uv.exe');
  if (!existsSync(uvExe)) { log('安装 uv...'); copyFileSync(join(vendorDir, 'uv', 'uv.exe'), uvExe); ok('uv 已安装'); }
  else { ok('uv 已就绪'); }

  if (!existsSync(join(PY_DIR, 'python.exe'))) { log('安装 Python 3.13...'); robocopySafe(join(vendorDir, 'python313'), PY_DIR); ok('Python 3.13 已安装'); }
  else { ok('Python 3.13 已就绪'); }

  const needRebuild = !existsSync(join(MCP_DIR, '.venv', 'Scripts', 'python.exe'));

  if (!existsSync(join(MCP_DIR, 'pyproject.toml'))) {
    log('安装 Windows-MCP...');
    robocopyExclude(join(vendorDir, 'windows-mcp'), MCP_DIR, ['.venv']);
    ok('Windows-MCP 源码已安装');
  } else {
    ok('Windows-MCP 已就绪');
  }

  if (needRebuild) {
    if (!rebuildVenv()) return false;
  }

  if (!verifyMcpWorks()) {
    log('.venv 可能损坏，尝试重建...');
    if (!rebuildVenv()) return false;
    if (!verifyMcpWorks()) {
      err('MCP 服务器无法启动，请检查网络后重试');
      return false;
    }
  }

  return true;
}

function registerMcpServer(): void {
  const config = getConfig();
  const servers = [...(config.mcpServers || [])];
  const existing = servers.findIndex((s: MCPConfigEntry) => s.name === SERVER_NAME);
  const pythonExe = join(MCP_DIR, '.venv', 'Scripts', 'python.exe');
  const entry: MCPConfigEntry = {
    name: SERVER_NAME,
    command: pythonExe,
    args: ['-m', 'windows_mcp', 'serve'],
    cwd: MCP_DIR,
    env: { VIRTUAL_ENV: join(MCP_DIR, '.venv'), PATH: `${join(MCP_DIR, '.venv', 'Scripts')};${process.env.PATH || ''}` },
    enabled: true,
    autoConnect: true,
  };
  if (existing >= 0) servers[existing] = entry;
  else servers.push(entry);
  updateConfig({ mcpServers: servers } as any);
  ok(`MCP 服务器 "${SERVER_NAME}" 已配置`);
}

export async function cmcCommand(): Promise<void> {
  console.log();
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │   🖥️  Windows-MCP 电脑控制模式                │');
  console.log('  │   AI 将能直接操控你的 Windows 桌面             │');
  console.log('  │   预置依赖 · 首次需重建 .venv · 之后纯离线      │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log();

  if (process.platform !== 'win32') { err('Windows-MCP 仅支持 Windows 系统'); process.exit(1); }

  const vendorDir = getVendorDir();
  if (!vendorDir) { err('未找到内置依赖包。请重新安装: npm install -g deeper-cli@latest'); process.exit(1); }

  if (!setupFromVendor(vendorDir)) process.exit(1);
  registerMcpServer();

  console.log();
  ok('正在启动电脑控制模式...');
  console.log();

  const { chat } = await import('./chat.js');
  await chat();
}
