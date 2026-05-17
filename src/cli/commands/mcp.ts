import { existsSync, readFileSync } from 'node:fs';
import { bootstrap } from '../bootstrap.ts';
import { DEEPER_MCP_FILE } from '../../core/constants.ts';
import { getConfig, updateConfig, type MCPConfigEntry } from '../../core/config.ts';

export async function mcpCommand(args: string[]): Promise<void> {
  const result = await bootstrap();
  if (!result.success) {
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
    }
    process.exit(1);
  }

  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list':
    case 'ls': {
      const config = getConfig();
      const servers = config.mcpServers || [];

      console.log('\n🔌 MCP 服务器:\n');

      if (servers.length === 0) {
        console.log('   (未配置任何 MCP 服务器)');
        console.log();
        console.log('   使用 "deeper mcp add" 添加 MCP 服务器');
      } else {
        for (const server of servers) {
          const status = server.enabled ? '✅ 启用' : '⏸ 禁用';
          const type = server.url ? 'SSE/HTTP' : 'Stdio';
          console.log(`   📡 ${server.name.padEnd(20)} ${status} | ${type}`);
          if (server.command) {
            console.log(`      命令: ${server.command} ${(server.args || []).join(' ')}`);
          }
          if (server.url) {
            console.log(`      URL: ${server.url}`);
          }
          if (server.autoConnect) {
            console.log(`      🔗 自动连接`);
          }
        }
      }
      console.log();
      break;
    }

    case 'add': {
      const name = args[1];
      const type = args[2];

      if (!name) {
        console.error('❌ 用法: deeper mcp add <name> stdio <command> [args...]');
        console.error('         deeper mcp add <name> sse <url>');
        process.exit(1);
      }

      const config = getConfig();
      const servers = [...(config.mcpServers || [])];

      if (servers.find((s) => s.name === name)) {
        console.error(`❌ MCP 服务器 "${name}" 已存在`);
        process.exit(1);
      }

      if (type === 'stdio') {
        const command = args[3];
        if (!command) {
          console.error('❌ 请提供命令');
          process.exit(1);
        }
        const cmdArgs = args.slice(4);
        servers.push({
          name,
          command,
          args: cmdArgs,
          enabled: true,
          autoConnect: true,
        });
      } else if (type === 'sse' || type === 'http') {
        const url = args[3];
        if (!url) {
          console.error('❌ 请提供 URL');
          process.exit(1);
        }
        servers.push({
          name,
          url,
          enabled: true,
          autoConnect: true,
        });
      } else {
        console.error('❌ 未知类型。支持: stdio, sse');
        process.exit(1);
      }

      updateConfig({ mcpServers: servers } as any);
      console.log(`✅ MCP 服务器 "${name}" 已添加`);
      break;
    }

    case 'remove':
    case 'rm': {
      const name = args[1];
      if (!name) {
        console.error('❌ 用法: deeper mcp remove <name>');
        process.exit(1);
      }

      const config = getConfig();
      const servers = (config.mcpServers || []).filter((s) => s.name !== name);

      if (servers.length === config.mcpServers?.length) {
        console.error(`❌ MCP 服务器 "${name}" 不存在`);
        process.exit(1);
      }

      updateConfig({ mcpServers: servers } as any);
      console.log(`✅ MCP 服务器 "${name}" 已移除`);
      break;
    }

    case 'connect': {
      const name = args[1];
      if (!name) {
        console.error('❌ 用法: deeper mcp connect <name>');
        process.exit(1);
      }
      console.log(`🔌 连接 MCP 服务器 "${name}"...`);
      console.log('💡 在 REPL 中使用 /mcp 查看已连接的服务器');
      break;
    }

    case 'config': {
      const filePath = DEEPER_MCP_FILE;
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          console.log(`📄 MCP 配置文件: ${filePath}`);
          console.log(content);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`❌ 读取失败: ${msg}`);
        }
      } else {
        console.log(`MCP 配置文件不存在: ${filePath}`);
      }
      break;
    }

    default: {
      console.log(`
🔌 DeeperCode MCP 管理

用法:
  deeper mcp list                          列出所有 MCP 服务器
  deeper mcp add <name> stdio <cmd> [args] 添加 Stdio MCP 服务器
  deeper mcp add <name> sse <url>          添加 SSE/HTTP MCP 服务器
  deeper mcp remove <name>                 移除 MCP 服务器
  deeper mcp connect <name>                连接 MCP 服务器
  deeper mcp config                        查看 MCP 配置文件

示例:
  deeper mcp add filesystem stdio npx -y @modelcontextprotocol/server-filesystem
  deeper mcp add myserver sse http://localhost:3001
  deeper mcp remove myserver
`);
      break;
    }
  }
}
