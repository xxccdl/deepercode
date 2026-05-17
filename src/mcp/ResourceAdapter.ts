import type { Tool, ToolResult } from '../tools/tool-types.js';
import type { MCPResource } from './types.js';
import type { MCPClient } from './MCPClient.js';

export class ResourceAdapter {
  private client: MCPClient;

  constructor(client: MCPClient) {
    this.client = client;
  }

  async readResource(serverName: string, uri: string): Promise<string> {
    const content = await this.client.readResource(serverName, uri);
    return content;
  }

  async listResources(serverName: string): Promise<MCPResource[]> {
    return this.client.listResources(serverName);
  }

  createResourceTools(resources: MCPResource[], serverName: string): Tool[] {
    return resources.map((resource) => this.adaptResource(resource, serverName));
  }

  private adaptResource(resource: MCPResource, serverName: string): Tool {
    const adaptedName = `mcp:${serverName}:resource:${resource.name}`;

    return {
      name: adaptedName,
      description: `[MCP:${serverName}] Read resource: ${resource.name} (${resource.uri})`,
      category: 'system',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      dangerous: false,
      requiresApproval: false,
      execute: async (_params: Record<string, unknown>, _signal?: AbortSignal): Promise<ToolResult> => {
        try {
          const content = await this.client.readResource(serverName, resource.uri);
          return {
            success: true,
            output: content,
            metadata: { uri: resource.uri, mimeType: resource.mimeType },
          };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            output: '',
            error: `MCP resource error [${serverName}/${resource.name}]: ${errMsg}`,
          };
        }
      },
    };
  }
}
