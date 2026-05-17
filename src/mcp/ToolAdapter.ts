import type { Tool, ToolResult } from '../tools/tool-types.js';
import type { MCPTool } from './types.js';
import type { MCPClient } from './MCPClient.js';

export class ToolAdapter {
  private client: MCPClient;

  constructor(client: MCPClient) {
    this.client = client;
  }

  adapt(mcpTool: MCPTool, serverName: string): Tool {
    const adaptedName = `mcp:${serverName}:${mcpTool.name}`;

    const tool: Tool = {
      name: adaptedName,
      description: `[MCP:${serverName}] ${mcpTool.description}`,
      category: this.inferCategory(mcpTool) as string,
      parameters: mcpTool.inputSchema,
      dangerous: false,
      requiresApproval: false,
      execute: async (params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> => {
        try {
          const result = await this.client.callTool(serverName, mcpTool.name, params);
          return result;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            output: '',
            error: `MCP tool error [${serverName}/${mcpTool.name}]: ${errMsg}`,
          };
        }
      },
    };

    return tool;
  }

  adaptBatch(mcpTools: MCPTool[], serverName: string): Tool[] {
    return mcpTools.map((t) => this.adapt(t, serverName));
  }

  private inferCategory(mcpTool: MCPTool): string {
    const desc = (mcpTool.description + ' ' + mcpTool.name).toLowerCase();

    if (desc.includes('file') || desc.includes('dir') || desc.includes('path')) {
      return 'filesystem';
    }
    if (desc.includes('search') || desc.includes('find') || desc.includes('query')) {
      return 'search';
    }
    if (desc.includes('shell') || desc.includes('command') || desc.includes('exec')) {
      return 'shell';
    }
    if (desc.includes('http') || desc.includes('api') || desc.includes('fetch') || desc.includes('url')) {
      return 'network';
    }
    if (desc.includes('code') || desc.includes('lint') || desc.includes('compile')) {
      return 'code';
    }
    if (desc.includes('db') || desc.includes('sql') || desc.includes('database')) {
      return 'database';
    }
    if (desc.includes('security') || desc.includes('auth') || desc.includes('token')) {
      return 'security';
    }

    return 'system';
  }
}
