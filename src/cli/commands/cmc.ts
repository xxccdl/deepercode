import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEEPER_HOME } from '../../core/constants.js';
import { getConfig, updateConfig, type MCPConfigEntry } from '../../core/config.js';

const BIN_DIR = join(DEEPER_HOME, 'bin');
const MCP_DIR = join(DEEPER_HOME, 'mcp_servers', 'windows-mcp');
const PY_DIR = join(DEEPER_HOME, 'python313');
const SERVER_NAME = 'windows-mcp';

let _cachedVendorDir: string | null = null;
function getVendorDir(): string {
  if (_cachedVendorDir) return _cachedVendorDir;
  try {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor');
    if (existsSync(join(dir, '.ready'))) { _cachedVendorDir = dir; return dir; }
  } catch {}
  const fallback = resolve(process.cwd(), 'vendor');
  if (existsSync(join(fallback, '.ready'))) { _cachedVendorDir = fallback; return fallback; }
  return '';
}

function log(msg: string) { console.log(`  ${msg}`); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function err(msg: string) { console.error(`  ❌ ${msg}`); }
function ensureDir(dir: string) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function robocopy(src: string, dst: string) {
  execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { timeout: 300_000, stdio: 'pipe' });
}

function fixPvenvCfg(venvDir: string, pythonHome: string) {
  const cfgPath = join(venvDir, 'pyvenv.cfg');
  if (!existsSync(cfgPath)) return;
  let content = readFileSync(cfgPath, 'utf-8');
  content = content.replace(/^home\s*=\s*.*$/m, `home = ${pythonHome}`);
  writeFileSync(cfgPath, content, 'utf-8');
}

function setupFromVendor(vendorDir: string): boolean {
  ensureDir(BIN_DIR);
  ensureDir(join(DEEPER_HOME, 'mcp_servers'));
  ensureDir(PY_DIR);

  // 1. uv.exe
  const uvSrc = join(vendorDir, 'uv', 'uv.exe');
  const uvDst = join(BIN_DIR, 'uv.exe');
  if (!existsSync(uvDst)) {
    log('安装 uv...');
    copyFileSync(uvSrc, uvDst);
    ok('uv 已安装');
  } else {
    ok('uv 已就绪');
  }

  // 2. Python 3.13
  const pySrc = join(vendorDir, 'python313');
  if (!existsSync(join(PY_DIR, 'python.exe'))) {
    log('安装 Python 3.13...');
    robocopy(pySrc, PY_DIR);
    ok('Python 3.13 已安装');
  } else {
    ok('Python 3.13 已就绪');
  }

  // 3. Windows-MCP (source + .venv)
  const mcpSrc = join(vendorDir, 'windows-mcp');
  if (!existsSync(join(MCP_DIR, 'pyproject.toml'))) {
    log('安装 Windows-MCP...');
    robocopy(mcpSrc, MCP_DIR);
    ok('Windows-MCP 已安装');
  } else {
    ok('Windows-MCP 已就绪');
  }

  // Fix .venv/pyvenv.cfg to point to the installed Python
  const venvDir = join(MCP_DIR, '.venv');
  if (existsSync(join(venvDir, 'pyvenv.cfg'))) {
    fixPvenvCfg(venvDir, PY_DIR);
  }

  return true;
}

function registerMcpServer(): void {
  const config = getConfig();
  const servers = [...(config.mcpServers || [])];
  const existing = servers.findIndex((s: MCPConfigEntry) => s.name === SERVER_NAME);
  const entry: MCPConfigEntry = {
    name: SERVER_NAME,
    command: join(BIN_DIR, 'uv.exe'),
    args: ['run', 'windows-mcp'],
    cwd: MCP_DIR,
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
  console.log('  │   预置依赖 · 离线可用 · 无需网络               │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log();

  if (process.platform !== 'win32') {
    err('Windows-MCP 仅支持 Windows 系统');
    process.exit(1);
  }

  const vendorDir = getVendorDir();
  if (!vendorDir) {
    err('未找到内置依赖包。请重新安装: npm install -g deeper-cli@latest');
    process.exit(1);
  }

  if (!setupFromVendor(vendorDir)) process.exit(1);

  registerMcpServer();

  console.log();
  ok('一切就绪，正在启动电脑控制模式...');
  console.log();

  const { chat } = await import('./chat.js');
  await chat();
}
