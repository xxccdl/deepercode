const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpHome = path.join(os.tmpdir(), 'deeper-test-empty-' + Date.now());
fs.mkdirSync(tmpHome, { recursive: true });
// 确保 config.json 不存在
const cfg = path.join(tmpHome, 'config.json');
if (fs.existsSync(cfg)) fs.unlinkSync(cfg);

const env = { ...process.env, DEEPER_HOME: tmpHome, DEEPSEEK_API_KEY: '', SILICONFLOW_API_KEY: '' };

const r1 = spawnSync('node', ['dist/cli/index.js', 'chat'], { env, encoding: 'utf-8' });
console.log('=== exit code:', r1.status);
console.log(r1.stdout || r1.stderr);
