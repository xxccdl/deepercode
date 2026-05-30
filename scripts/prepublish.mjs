import { existsSync, mkdirSync, unlinkSync, renameSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VENDOR = join(ROOT, 'vendor');
const ARCH = process.arch;

const UV_ZIP = ARCH === 'arm64' ? 'uv-aarch64-pc-windows-msvc.zip' : 'uv-x86_64-pc-windows-msvc.zip';
const UV_REPO = 'astral-sh/uv';
const MCP_REPO = 'CursorTouch/Windows-MCP';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function err(msg) { console.error(`  ❌ ${msg}`); }
function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function curlDownload(url, dest) {
  ensureDir(dirname(dest));
  execSync(`curl -L --connect-timeout 30 --retry 3 -o "${dest}" "${url}"`, {
    encoding: 'utf-8', timeout: 600_000, stdio: 'inherit',
  });
}

function extractZip(zipPath, destDir) {
  ensureDir(destDir);
  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
    encoding: 'utf-8', timeout: 120_000, stdio: 'pipe',
  });
}

function findSingleDir(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  return dirs.length === 1 ? resolve(root, dirs[0].name) : null;
}

function robocopySafe(src, dst) {
  try {
    execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { timeout: 300_000, stdio: 'pipe' });
  } catch (e) {
    // robocopy exits 0-7; 0-3 are all "success"
    if (e.status > 3) throw e;
  }
}

function getLatestUrl(repo, asset) {
  const json = execSync(`curl -sL "https://api.github.com/repos/${repo}/releases/latest"`, { encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
  const release = JSON.parse(json);
  const assets = release.assets || [];
  const found = assets.find(a => a.name === asset);
  if (found) return found.browser_download_url;
  const tag = release.tag_name || 'latest';
  return `https://github.com/${repo}/releases/download/${tag}/${asset}`;
}

function ensureUv() {
  const uvDest = join(VENDOR, 'uv', 'uv.exe');
  if (existsSync(uvDest)) { ok(`uv 已缓存 (${(readFileSync(uvDest).length / 1024 / 1024).toFixed(1)}MB)`); return uvDest; }
  ensureDir(join(VENDOR, 'uv'));
  const zipPath = join(VENDOR, 'uv', '_uv.zip');
  log('下载 uv...');
  curlDownload(getLatestUrl(UV_REPO, UV_ZIP), zipPath);
  log('解压 uv...');
  const tmpDir = join(VENDOR, 'uv', '_tmp');
  extractZip(zipPath, tmpDir);
  const exePath = resolve(tmpDir, 'uv.exe');
  if (!existsSync(exePath)) throw new Error('zip 中未找到 uv.exe');
  renameSync(exePath, uvDest);
  execSync(`powershell -Command "Remove-Item -Path '${tmpDir}' -Recurse -Force -ErrorAction SilentlyContinue"`, { timeout: 30_000, stdio: 'pipe' });
  unlinkSync(zipPath);
  ok(`uv 已缓存 (${(readFileSync(uvDest).length / 1024 / 1024).toFixed(1)}MB)`);
  return uvDest;
}

function ensurePython(uvExe) {
  const pyDir = join(VENDOR, 'python313');
  if (existsSync(join(pyDir, 'python.exe'))) { ok('Python 3.13 已缓存'); return; }
  ensureDir(pyDir);
  log('uv 下载 Python 3.13...');
  execSync(`"${uvExe}" python install 3.13`, { encoding: 'utf-8', timeout: 600_000, stdio: 'pipe' });
  const findResult = execSync(`"${uvExe}" python find 3.13`, { encoding: 'utf-8', timeout: 15_000, stdio: 'pipe' }).trim();
  if (!findResult || !existsSync(findResult)) throw new Error(`无法找到 Python: ${findResult}`);
  log('复制 Python 到 vendor...');
  robocopySafe(dirname(findResult), pyDir);
  ok('Python 3.13 已缓存');
}

function ensureWindowsMcp(uvExe) {
  const mcpDir = join(VENDOR, 'windows-mcp');
  const hasSource = existsSync(join(mcpDir, 'pyproject.toml'));
  const hasVenv = existsSync(join(mcpDir, '.venv'));

  if (hasSource && hasVenv) { ok('Windows-MCP + .venv 已缓存'); return; }

  if (!hasSource) {
    ensureDir(mcpDir);
    const zipPath = join(VENDOR, '_wmcp.zip');
    log('下载 Windows-MCP...');
    curlDownload(`https://github.com/${MCP_REPO}/archive/refs/heads/main.zip`, zipPath);
    log('解压 Windows-MCP...');
    const tmpDir = join(VENDOR, '_wmcp_tmp');
    extractZip(zipPath, tmpDir);
    const innerDir = findSingleDir(tmpDir);
    if (!innerDir) throw new Error('解压后目录结构异常');
    robocopySafe(innerDir, mcpDir);
    execSync(`powershell -Command "Remove-Item -Path '${tmpDir}' -Recurse -Force -ErrorAction SilentlyContinue"`, { timeout: 30_000, stdio: 'pipe' });
    unlinkSync(zipPath);
    ok('Windows-MCP 源码已缓存');
  }

  log('uv sync 构建 .venv...');
  const pyExe = join(VENDOR, 'python313', 'python.exe');
  execSync(`"${uvExe}" sync --python "${pyExe}"`, { cwd: mcpDir, encoding: 'utf-8', timeout: 600_000, stdio: 'pipe' });
  ok('.venv 构建完成');
}

function main() {
  console.log();
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │   📦 预缓存离线依赖到 vendor/                  │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log();

  ensureDir(VENDOR);

  const uvExe = ensureUv();
  ensurePython(uvExe);
  ensureWindowsMcp(uvExe);

  writeFileSync(join(VENDOR, '.ready'), Date.now().toString());

  console.log();
  ok('所有依赖已缓存到 vendor/');
  try {
    const size = execSync(`powershell -Command "(Get-ChildItem -Path '${VENDOR}' -Recurse | Measure-Object -Property Length -Sum).Sum"`, { encoding: 'utf-8', timeout: 30_000 }).trim();
    if (size) log(`vendor 总大小: ~${(parseInt(size, 10) / 1024 / 1024).toFixed(0)}MB`);
  } catch {}
  console.log();
}

main();
