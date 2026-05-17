import { getConfig, loadConfig } from '../../core/config.ts';

interface ChatOptions {
  model?: string;
  apiKey?: string;
  verbose?: boolean;
  autoRun?: string;
}

export async function chat(opts: ChatOptions = {}): Promise<void> {
  const config = getConfig() || loadConfig();

  const apiKey = opts.apiKey || config.apiKey || process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) {
    console.error('❌ 未设置 API Key');
    console.error('');
    console.error('   请运行以下命令之一:');
    console.error('     deeper config set api_key "sk-你的密钥"');
    console.error('     或设置环境变量: set DEEPSEEK_API_KEY=sk-你的密钥');
    console.error('');
    console.error('   获取密钥: https://platform.deepseek.com');
    process.exit(1);
  }

  const model = opts.model || config.model || 'deepseek-v4-pro';
  const baseUrl = config.baseUrl || 'https://api.deepseek.com';
  const isFlash = model.includes('flash');

  const { startRepl } = await import('../chat-repl.js');
  await startRepl({
    apiKey,
    model,
    baseUrl,
    maxTokens: 8192,
    temperature: config.temperature ?? (isFlash ? 0.3 : 0.7),
    thinkEnabled: config.thinkEnabled ?? !isFlash,
    thinkBudget: config.thinkBudget ?? (isFlash ? 0 : 16000),
  });
}
