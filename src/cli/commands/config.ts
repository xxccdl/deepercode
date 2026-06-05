import { getConfig, updateConfig, resetConfig, type DeeperConfig } from '../../core/config.ts';
import { loadConfig } from '../../core/config.ts';
import { DEEPER_CONFIG_FILE } from '../../core/constants.ts';

export async function configCommand(args: string[]): Promise<void> {
  loadConfig();
  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list':
    case 'ls': {
      const config = getConfig();
      console.log('\n📋 DeeperCode 配置:\n');
      const displayKeys: { key: string; value: unknown; mask?: boolean }[] = [
        { key: 'model', value: config.model },
        { key: 'baseUrl', value: config.baseUrl },
        { key: 'apiKey', value: config.apiKey || '', mask: true },
        { key: 'siliconflowApiKey', value: config.siliconflowApiKey || '', mask: true },
        { key: 'maxTokens', value: config.maxTokens },
        { key: 'thinkBudget', value: config.thinkBudget },
        { key: 'thinkEnabled', value: config.thinkEnabled },
        { key: 'temperature', value: config.temperature },
        { key: 'maxSubAgents', value: config.maxSubAgents },
        { key: 'maxRecursionDepth', value: config.maxRecursionDepth },
        { key: 'timeoutMs', value: config.timeoutMs },
        { key: 'theme', value: config.theme },
        { key: 'locale', value: config.locale },
      ];
      for (const { key, value, mask } of displayKeys) {
        const raw = String(value ?? '');
        const display = mask
          ? (raw ? `${raw.slice(0, 8)}...${raw.slice(-4)}` : '(未设置)')
          : JSON.stringify(value);
        console.log(`  ${key.padEnd(20)} ${display}`);
      }
      console.log();
      break;
    }

    case 'get': {
      const rawKey = args[1];
      if (!rawKey) {
        console.error('❌ 用法: deeper config get <key>');
        process.exit(1);
      }
      const KEY_ALIASES: Record<string, string> = {
        api_key: 'apiKey', 'api-key': 'apiKey', apikey: 'apiKey', key: 'apiKey',
        siliconflow_api_key: 'siliconflowApiKey', 'siliconflow-api-key': 'siliconflowApiKey',
      };
      const key = KEY_ALIASES[rawKey.toLowerCase()] || rawKey;
      const config = getConfig();
      const value = (config as Record<string, unknown>)[key];
      if (value === undefined) {
        console.error(`❌ 未知配置项: ${rawKey}`);
        process.exit(1);
      }
      if (key === 'apiKey') {
        const str = String(value || '');
        console.log(str ? `${str.slice(0, 8)}...${str.slice(-4)}` : '(未设置)');
      } else {
        console.log(JSON.stringify(value, null, 2));
      }
      break;
    }

    case 'set': {
      const rawKey = args[1];
      const rawValue = args[2];
      if (!rawKey || rawValue === undefined) {
        console.error('❌ 用法: deeper config set <key> <value>');
        process.exit(1);
      }

      const KEY_ALIASES: Record<string, string> = {
        api_key: 'apiKey', 'api-key': 'apiKey', apikey: 'apiKey', key: 'apiKey',
        base_url: 'baseUrl', 'base-url': 'baseUrl',
        max_tokens: 'maxTokens', 'max-tokens': 'maxTokens',
        think_budget: 'thinkBudget', 'think-budget': 'thinkBudget',
        think_enabled: 'thinkEnabled', 'think-enabled': 'thinkEnabled',
        log_level: 'logLevel', 'log-level': 'logLevel',
        max_retries: 'maxRetries', 'max-retries': 'maxRetries',
        timeout_ms: 'timeoutMs', 'timeout-ms': 'timeoutMs',
        max_sub_agents: 'maxSubAgents', 'max-sub-agents': 'maxSubAgents',
        max_recursion_depth: 'maxRecursionDepth', 'max-recursion-depth': 'maxRecursionDepth',
        siliconflow_api_key: 'siliconflowApiKey', 'siliconflow-api-key': 'siliconflowApiKey',
      };
      const key = KEY_ALIASES[rawKey.toLowerCase()] || rawKey;

      try {
        let parsedValue: unknown = rawValue;
        if (rawValue === 'true') parsedValue = true;
        else if (rawValue === 'false') parsedValue = false;
        else if (!isNaN(Number(rawValue))) parsedValue = Number(rawValue);

        updateConfig({ [key]: parsedValue } as Partial<DeeperConfig>);
        console.log(`✅ 已设置 ${key} = ${JSON.stringify(parsedValue)}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ 设置失败: ${msg}`);
        process.exit(1);
      }
      break;
    }

    case 'reset': {
      const config = resetConfig();
      console.log('✅ 配置已重置为默认值');
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case 'path': {
      console.log(`配置文件路径: ${DEEPER_CONFIG_FILE}`);
      break;
    }

    default: {
      console.log(`
📋 DeeperCode 配置管理

用法:
  deeper config list              列出所有配置
  deeper config get <key>         获取配置项
  deeper config set <key> <value> 设置配置项
  deeper config reset             重置配置
  deeper config path              显示配置文件路径

示例:
  deeper config set model deepseek-v4-pro
  deeper config set theme light
  deeper config get apiKey
`);
      break;
    }
  }
}
