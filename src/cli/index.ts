#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { DEEPER_VERSION } from '../core/constants.ts';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return startChat({});
  }

  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      model: { type: 'string', short: 'm' },
      'api-key': { type: 'string', short: 'k' },
      verbose: { type: 'boolean' },
      'auto-run': { type: 'string' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    showHelp();
    return;
  }

  if (values.version) {
    console.log(`DeeperCode v${DEEPER_VERSION}`);
    return;
  }

  const command = positionals[0];
  const commandArgs = positionals.slice(1);

  const globalOpts = {
    model: values.model || process.env.DEEPER_MODEL,
    apiKey: values['api-key'] || process.env.DEEPSEEK_API_KEY,
    verbose: values.verbose,
  };

  switch (command) {
    case 'chat':
    case 'repl': {
      await startChat({
        ...globalOpts,
        autoRun: values['auto-run'],
      });
      break;
    }

    case 'run':
    case 'exec': {
      const task = commandArgs.join(' ');
      if (!task) {
        console.error('❌ 请提供任务描述');
        console.error('   用法: deeper run "任务描述"');
        process.exit(1);
      }
      const { run } = await import('./commands/run.ts');
      await run(task, globalOpts);
      break;
    }

    case 'config': {
      const { configCommand } = await import('./commands/config.ts');
      await configCommand(commandArgs);
      break;
    }

    case 'skill':
    case 'skills': {
      const { skillCommand } = await import('./commands/skill.ts');
      await skillCommand(commandArgs);
      break;
    }

    case 'mcp': {
      const { mcpCommand } = await import('./commands/mcp.ts');
      await mcpCommand(commandArgs);
      break;
    }

    case 'version': {
      console.log(`DeeperCode v${DEEPER_VERSION}`);
      break;
    }

    default: {
      const task = positionals.join(' ').trim();
      if (task) {
        const { run } = await import('./commands/run.ts');
        await run(task, globalOpts);
      } else {
        console.error(`未知命令: ${positionals[0] || ''}`);
        console.error('使用 --help 查看帮助');
        process.exit(1);
      }
    }
  }
}

async function startChat(opts: {
  model?: string;
  apiKey?: string;
  verbose?: boolean;
  autoRun?: string;
}) {
  const { chat } = await import('./commands/chat.js');
  await chat(opts);
}

function showHelp() {
  console.log(`
██████╗ ███████╗███████╗██████╗ ███████╗██████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██╔══██╗
██║  ██║█████╗  █████╗  ██████╔╝█████╗  ██████╔╝
██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██╔══╝  ██╔══██╗
██████╔╝███████╗███████╗██║     ███████╗██║  ██║
╚═════╝ ╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝
██████╗ ██████╗ ██████╗ ███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║     ██║   ██║██║  ██║█████╗
██║     ██║   ██║██║  ██║██╔══╝
╚██████╗╚██████╔╝██████╔╝███████╗
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝

DeeperCode v${DEEPER_VERSION} - 一句话生成完整项目的 AI Agentic CLI 工具

用法:
  deeper [options]                 启动交互式 REPL
  deeper chat [options]            启动聊天模式
  deeper run "任务描述" [options]   单次执行任务
  deeper config <subcommand>       配置管理
  deeper skill <subcommand>        Skill 管理
  deeper mcp <subcommand>          MCP 管理

选项:
  -h, --help            显示帮助信息
  -v, --version         显示版本号
  -m, --model <model>   指定模型 (默认: deepseek-v4-pro, 可选: v4-flash)
  -k, --api-key <key>   指定 API Key
  --verbose             详细输出模式
  --auto-run <task>     自动运行任务后进入 REPL

子命令:
  deeper config list              列出配置
  deeper config set <key> <value> 设置配置
  deeper config get <key>         获取配置
  deeper config reset             重置配置

  deeper skill list               列出 Skills
  deeper skill create <name>      创建 Skill

  deeper mcp list                 列出 MCP 服务器
  deeper mcp add <name> ...       添加 MCP 服务器
  deeper mcp remove <name>        移除 MCP 服务器

环境变量:
  DEEPSEEK_API_KEY    DeepSeek API Key
  DEEPER_HOME         DeeperCode 数据目录 (默认: ~/.deeper)
  DEEPER_MODEL        默认模型名称

内存:
  如遇 OOM，使用 node --max-old-space-size=4096 $(which deeper) 启动
  Windows: set NODE_OPTIONS=--max-old-space-size=4096 && deeper

示例:
  deeper                             启动交互式 REPL
  deeper run "创建一个 React 应用"    单次执行
  deeper --model deepseek-v4-pro -k sk-xxxx  指定模型和密钥
  deeper --model deepseek-v4-flash             使用快速模型
  deeper config set theme light      切换亮色主题

使用 DeepSeek-V4-Pro 驱动 | 105+ 内置工具 | 强大的 Agent 系统
`);
}

main().catch((err) => {
  console.error('❌ 启动失败:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
