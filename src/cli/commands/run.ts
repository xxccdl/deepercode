import { loadConfig, getApiKey } from '../../core/config.ts';
import { bootstrap } from '../bootstrap.ts';
import { getModelBaseUrl } from '../../core/constants.js';
import type { DeeperConfig } from '../../core/config.ts';

interface RunOptions {
  task?: string;
  model?: string;
  apiKey?: string;
  files?: string[];
}

export async function run(task: string, opts: RunOptions = {}): Promise<void> {
  const result = await bootstrap();

  if (!result.success) {
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
    }
    process.exit(1);
  }

  if (!task) {
    console.error('❌ 请提供任务描述。用法: deeper run "任务描述"');
    process.exit(1);
  }

  const config: DeeperConfig = {
    ...result.config,
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
  };

  const apiKey = opts.apiKey || getApiKey();

  if (!apiKey) {
    console.error('❌ 未设置 API Key (set DEEPSEEK_API_KEY=sk-... 或 SILICONFLOW_API_KEY=sk-...)');
    process.exit(1);
  }

  const model = config.model;
  const modelBaseUrl = getModelBaseUrl(model);
  const baseUrl = (config.baseUrl && config.baseUrl !== 'https://api.deepseek.com') ? config.baseUrl : modelBaseUrl;

  console.log(`\n🚀 DeeperCode 执行任务\n`);
  console.log(`📋 任务: ${task}`);
  console.log(`🤖 模型: ${model}`);
  console.log(`🔗 API: ${baseUrl}`);
  console.log();

  console.log('⏳ 正在连接 API...');
  console.log();

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个强大的 AI 编程助手。请帮助用户完成任务。',
          },
          {
            role: 'user',
            content: task,
          },
        ],
        stream: true,
        max_tokens: Math.max(1, Math.min(config.maxTokens || 4096, 131072)),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ API 请求失败 (${response.status}): ${text}`);
      process.exit(1);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ 无法读取响应流');
      process.exit(1);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let thinkingContent = '';

    console.log('📝 AI 响应:\n');
    console.log('─'.repeat(60));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.thinking || delta?.reasoning_content) {
            thinkingContent += delta.thinking || delta.reasoning_content || '';
          }

          if (delta?.content) {
            fullContent += delta.content;
            process.stdout.write(delta.content);
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log();

    if (thinkingContent) {
      console.log('💭 思考过程:');
      console.log('─'.repeat(60));
      console.log(thinkingContent.slice(0, 500));
      if (thinkingContent.length > 500) {
        console.log(`... (还有 ${thinkingContent.length - 500} 字符)`);
      }
      console.log('─'.repeat(60));
    }

    const usage = `📊 Token: ~${fullContent.length} 输出`;
    console.log(usage);
    console.log();

    console.log('✅ 任务执行完成！');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ 请求失败: ${msg}`);
    process.exit(1);
  }
}
