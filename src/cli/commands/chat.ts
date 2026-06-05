import { getConfig, loadConfig, getApiKey } from '../../core/config.ts';
import { getModelBaseUrl } from '../../core/constants.js';

interface ChatOptions {
  model?: string;
  apiKey?: string;
  verbose?: boolean;
  autoRun?: string;
}

export async function chat(opts: ChatOptions = {}): Promise<void> {
  const config = getConfig() || loadConfig();

  const model = opts.model || config.model || 'deepseek-v4-pro';
  const apiKey = opts.apiKey || getApiKey();
  if (!apiKey) {
    console.error('❌ 未设置 API Key (任设一个即可)');
    console.error('');
    console.error('   deeper config set api_key "sk-你的密钥"');
    console.error('   或 set DEEPSEEK_API_KEY=sk-你的密钥');
    console.error('   或 set SILICONFLOW_API_KEY=sk-你的密钥');
    process.exit(1);
  }

  const modelBaseUrl = getModelBaseUrl(model);
  const baseUrl = (config.baseUrl && config.baseUrl !== 'https://api.deepseek.com') ? config.baseUrl : modelBaseUrl;
  const isFlash = model.includes('flash') || model.includes('Flash');
  const isSiliconflow = model.includes('/');
  const supportsThink = model.includes('deepseek') || model.includes('GLM') || model.includes('Qwen') || model.includes('QwQ');

  const { startRepl } = await import('../chat-repl.js');
  await startRepl({
    apiKey,
    model,
    baseUrl,
    maxTokens: 8192,
    temperature: config.temperature ?? (isFlash ? 0.3 : 0.7),
    thinkEnabled: config.thinkEnabled ?? (supportsThink && !isFlash),
    thinkBudget: config.thinkBudget ?? (isFlash ? 0 : supportsThink ? 16000 : 0),
  });
}
