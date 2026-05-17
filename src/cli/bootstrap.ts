import { existsSync, mkdirSync } from 'node:fs';
import { DEEPER_HOME, DEEPER_CONFIG_FILE, DEEPER_SKILLS_DIR, DEEPER_SESSIONS_DIR, DEEPER_LOGS_DIR, DEEPER_VERSION } from '../core/constants.ts';
import { loadConfig } from '../core/config.ts';
import { eventbus } from '../core/eventbus.ts';

export interface BootstrapResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  config: ReturnType<typeof loadConfig>;
}

export async function bootstrap(): Promise<BootstrapResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
  if (majorVersion < 20) {
    errors.push(`Node.js 版本过低: ${nodeVersion}，需要 >= 20.0.0`);
    return { success: false, errors, warnings, config: loadConfig() };
  }

  const dirs = [
    DEEPER_HOME,
    DEEPER_SKILLS_DIR,
    DEEPER_SESSIONS_DIR,
    DEEPER_LOGS_DIR,
  ];

  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch {
      errors.push(`无法创建目录: ${dir}`);
    }
  }

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`配置加载失败: ${msg}`);
    config = loadConfig();
  }

  if (!config.apiKey && !process.env.DEEPSEEK_API_KEY) {
    warnings.push('未设置 API Key。请运行: deeper config set api_key "sk-你的密钥"');
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, config };
  }

  return { success: true, errors, warnings, config };
}

export function checkNodeVersion(): boolean {
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
  return majorVersion >= 20;
}

export function getVersionInfo(): string {
  return `DeeperCode v${DEEPER_VERSION} | Node.js ${process.versions.node} | ${process.platform} ${process.arch}`;
}
