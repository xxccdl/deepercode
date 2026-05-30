import { existsSync, mkdirSync, createWriteStream, unlinkSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { get as httpsGet } from 'node:https';
import { DEEPER_HOME } from '../../core/constants.js';
import { getConfig, updateConfig, type MCPConfigEntry } from '../../core/config.js';

const BIN_DIR = join(DEEPER_HOME, 'bin');
const UV_EXE = join(BIN_DIR, 'uv.exe');
const MCP_DIR = join(DEEPER_HOME, 'mcp_servers', 'windows-mcp');
const SERVER_NAME = 'windows-mcp';
const MCP_ZIP_URL = 'https://github.com/CursorTouch/Windows-MCP/archive/refs/heads/main.zip';
const UV_DOWNLOAD_URL = process.arch === 'arm64'
  ? 'https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-pc-windows-msvc.zip'
  : 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip';

function log(msg: string) { console.log(`  ${msg}`); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️ ${msg}`); }
function err(msg: string) { console.error(`  ❌ ${msg}`); }

function ensureDir(dir: string) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function downloadFile(url: string, dest: string, timeoutSec = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const timer = setTimeout(() => { file.close(); try { unlinkSync(dest); } catch {} reject(new Error('下载超时')); }, timeoutSec * 1000);
    httpsGet(url, { headers: { 'User-Agent': 'DeeperCode/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); try { unlinkSync(dest); } catch {}
        clearTimeout(timer);
        downloadFile(res.headers.location || '', dest, timeoutSec).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { file.close(); try { unlinkSync(dest); } catch {} clearTimeout(timer); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => { clearTimeout(timer); file.close(); resolve(); });
      file.on('error', (e) => { clearTimeout(timer); try { unlinkSync(dest); } catch {} reject(e); });
    }).on('error', (e) => { clearTimeout(timer); try { unlinkSync(dest); } catch {} reject(e); });
  });
}

function extractZip(zipPath: string, destDir: string): boolean {
  try {
    ensureDir(destDir);
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
      encoding: 'utf-8', timeout: 120_000, stdio: 'pipe',
    });
    return true;
  } catch { return false; }
}

function findSingleDir(root: string): string | null {
  const entries = readdirSync(root, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  if (dirs.length === 1) return resolve(root, dirs[0].name);
  return null;
}

async function ensureUv(): Promise<boolean> {
  if (existsSync(UV_EXE)) { ok('uv 已就绪 (本地缓存)'); return true; }
  ensureDir(BIN_DIR);
  const zipPath = join(BIN_DIR, 'uv.zip');
  log('下载 uv (首次 ~20MB)...');
  try {
    await downloadFile(UV_DOWNLOAD_URL, zipPath, 300);
    ok('下载完成');
    log('解压 uv...');
    const tmpDir = join(BIN_DIR, '_uv_tmp');
    if (!extractZip(zipPath, tmpDir)) { err('uv 解压失败'); return false; }
    const exePath = resolve(tmpDir, 'uv.exe');
    if (existsSync(exePath)) renameSync(exePath, UV_EXE);
    else { err('zip 中未找到 uv.exe'); return false; }
    rmSync(tmpDir, { recursive: true, force: true });
    unlinkSync(zipPath);
    ok('uv 安装完成');
    return true;
  } catch (e: unknown) { err(`uv 下载失败: ${e instanceof Error ? e.message : String(e)}`); return false; }
}

async function ensurePython313(): Promise<boolean> {
  try {
    const r = execSync(`"${UV_EXE}" python list --only-installed`, { encoding: 'utf-8', timeout: 15_000, stdio: 'pipe' });
    if (r.includes('3.13')) { ok('Python 3.13 已就绪 (uv 管理)'); return true; }
  } catch {}
  log('安装 Python 3.13 (通过 uv, 首次 ~30MB)...');
  try {
    execSync(`"${UV_EXE}" python install 3.13`, { encoding: 'utf-8', timeout: 300_000, stdio: 'pipe' });
    ok('Python 3.13 安装完成');
    return true;
  } catch (e: unknown) { err(`Python 安装失败: ${e instanceof Error ? e.message : String(e)}`); return false; }
}

async function ensureWindowsMcp(): Promise<boolean> {
  if (existsSync(join(MCP_DIR, 'pyproject.toml')) && existsSync(join(MCP_DIR, 'src'))) {
    ok('Windows-MCP 已就绪 (本地缓存)');
    log('检查更新...');
    try {
      const r = execSync(`"${UV_EXE}" sync`, { cwd: MCP_DIR, encoding: 'utf-8', timeout: 120_000, stdio: 'pipe' });
      ok('依赖已同步');
    } catch { warn('依赖同步失败，继续使用缓存版本'); }
    return true;
  }
  ensureDir(join(DEEPER_HOME, 'mcp_servers'));
  const zipPath = join(DEEPER_HOME, 'mcp_servers', '_wmcp.zip');
  log('下载 Windows-MCP (首次 ~5MB)...');
  try {
    await downloadFile(MCP_ZIP_URL, zipPath, 300);
    ok('下载完成');
    log('解压 Windows-MCP...');
    const tmpDir = join(DEEPER_HOME, 'mcp_servers', '_wmcp_tmp');
    if (!extractZip(zipPath, tmpDir)) { err('解压失败'); return false; }
    const innerDir = findSingleDir(tmpDir);
    if (!innerDir) { err('解压后目录结构异常'); return false; }
    if (existsSync(MCP_DIR)) rmSync(MCP_DIR, { recursive: true, force: true });
    renameSync(innerDir, MCP_DIR);
    rmSync(tmpDir, { recursive: true, force: true });
    unlinkSync(zipPath);
    ok('解压完成');

    log('安装 Python 依赖...');
    try {
      execSync(`"${UV_EXE}" sync`, { cwd: MCP_DIR, encoding: 'utf-8', timeout: 300_000, stdio: 'pipe' });
      ok('依赖安装完成');
    } catch (e: unknown) {
      err(`依赖安装失败: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
    return true;
  } catch (e: unknown) { err(`Windows-MCP 下载失败: ${e instanceof Error ? e.message : String(e)}`); return false; }
}

function registerMcpServer(): void {
  const config = getConfig();
  const servers = [...(config.mcpServers || [])];
  const existing = servers.findIndex((s: MCPConfigEntry) => s.name === SERVER_NAME);
  const entry: MCPConfigEntry = {
    name: SERVER_NAME,
    command: UV_EXE,
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
  console.log('  │   首次启动需下载组件 · 之后纯离线运行          │');
  console.log('  │   AI 将能直接操控你的 Windows 桌面             │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log();

  if (process.platform !== 'win32') {
    err('Windows-MCP 仅支持 Windows 系统');
    process.exit(1);
  }

  const uvOk = await ensureUv();
  if (!uvOk) process.exit(1);

  const pyOk = await ensurePython313();
  if (!pyOk) process.exit(1);

  const mcpOk = await ensureWindowsMcp();
  if (!mcpOk) process.exit(1);

  registerMcpServer();

  console.log();
  ok('一切就绪，正在启动电脑控制模式...');
  console.log();
  console.log('  📌 之后使用 `deeper cmc` 即可直接进入，无需再次下载');
  console.log();

  const { chat } = await import('./chat.js');
  await chat();
}
