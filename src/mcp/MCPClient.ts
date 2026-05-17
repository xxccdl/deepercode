import { EventBus, Events } from '../core/eventbus.js';
import { StdioTransport } from './StdioTransport.js';
import { SSETransport } from './SSETransport.js';
import { ToolAdapter } from './ToolAdapter.js';
import { ResourceAdapter } from './ResourceAdapter.js';
import type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPTransport,
  JSONRPCMessage,
  JSONRPCResponse,
} from './types.js';
import type { Tool, ToolResult } from '../tools/tool-types.js';
import { MCP_CONNECTION_TIMEOUT_MS } from '../core/constants.js';

interface ServerConnection {
  config: MCPServerConfig;
  transport: MCPTransport;
  tools: MCPTool[];
  resources: MCPResource[];
  connected: boolean;
}

export class MCPClient {
  private servers = new Map<string, ServerConnection>();
  private eventbus: EventBus;
  private toolAdapter: ToolAdapter;
  private resourceAdapter: ResourceAdapter;
  private requestIdCounter = 0;

  constructor(eventbus?: EventBus) {
    this.eventbus = eventbus || new EventBus();
    this.toolAdapter = new ToolAdapter(this);
    this.resourceAdapter = new ResourceAdapter(this);
  }

  async connect(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      await this.disconnect(config.name);
    }

    const transport: MCPTransport = config.type === 'stdio'
      ? new StdioTransport()
      : new SSETransport();

    const connection: ServerConnection = {
      config,
      transport,
      tools: [],
      resources: [],
      connected: false,
    };

    this.servers.set(config.name, connection);

    try {
      const connectPromise = transport.connect(config);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout: ${config.name}`)), MCP_CONNECTION_TIMEOUT_MS);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      connection.connected = true;

      transport.onMessage((message: JSONRPCMessage) => {
        this.handleMessage(config.name, message);
      });

      await this.initializeServer(config.name);

      this.eventbus.emit(Events.MCP_CONNECTED, {
        serverName: config.name,
        type: config.type,
      });
    } catch (error) {
      transport.disconnect();
      this.servers.delete(config.name);

      this.eventbus.emit(Events.MCP_ERROR, {
        serverName: config.name,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  disconnect(name: string): void {
    const connection = this.servers.get(name);
    if (!connection) return;

    connection.transport.disconnect();
    connection.connected = false;
    this.servers.delete(name);

    this.eventbus.emit(Events.MCP_DISCONNECTED, {
      serverName: name,
    });
  }

  disconnectAll(): void {
    for (const name of this.servers.keys()) {
      this.disconnect(name);
    }
  }

  listTools(serverName?: string): MCPTool[] {
    if (serverName) {
      const connection = this.servers.get(serverName);
      return connection ? [...connection.tools] : [];
    }

    const allTools: MCPTool[] = [];
    for (const [, conn] of this.servers) {
      allTools.push(...conn.tools);
    }
    return allTools;
  }

  getAdaptedTools(): Tool[] {
    const tools: Tool[] = [];
    for (const [name, conn] of this.servers) {
      tools.push(...this.toolAdapter.adaptBatch(conn.tools, name));
    }
    return tools;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      return {
        success: false,
        output: '',
        error: `Server not connected: ${serverName}`,
      };
    }

    if (!connection.connected) {
      return {
        success: false,
        output: '',
        error: `Server disconnected: ${serverName}`,
      };
    }

    try {
      const requestId = ++this.requestIdCounter;
      const response = await this.sendRequest(connection, requestId, 'tools/call', {
        name: toolName,
        arguments: args,
      });

      const result = response.result as Record<string, unknown> | undefined;
      const content = result?.content;

      if (Array.isArray(content)) {
        const textParts = content
          .filter((c: unknown) => {
            const item = c as Record<string, unknown>;
            return item?.type === 'text' && typeof item?.text === 'string';
          })
          .map((c: unknown) => (c as Record<string, string>).text);

        return {
          success: true,
          output: textParts.join('\n'),
        };
      }

      return {
        success: true,
        output: typeof content === 'string' ? content : JSON.stringify(content),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        error: errMsg,
      };
    }
  }

  async listResources(serverName: string): Promise<MCPResource[]> {
    const connection = this.servers.get(serverName);
    if (!connection) return [];

    try {
      const requestId = ++this.requestIdCounter;
      const response = await this.sendRequest(connection, requestId, 'resources/list', {});

      const result = response.result as Record<string, unknown> | undefined;
      const resources = result?.resources;

      if (Array.isArray(resources)) {
        return resources as MCPResource[];
      }

      return [];
    } catch {
      return [];
    }
  }

  async readResource(serverName: string, uri: string): Promise<string> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    const requestId = ++this.requestIdCounter;
    const response = await this.sendRequest(connection, requestId, 'resources/read', { uri });

    const result = response.result as Record<string, unknown> | undefined;
    const contents = result?.contents;

    if (Array.isArray(contents)) {
      const textParts = contents
        .filter((c: unknown) => {
          const item = c as Record<string, unknown>;
          return typeof item?.text === 'string';
        })
        .map((c: unknown) => (c as Record<string, string>).text);

      return textParts.join('\n');
    }

    return JSON.stringify(contents);
  }

  isConnected(name: string): boolean {
    const connection = this.servers.get(name);
    return connection ? connection.connected : false;
  }

  getConnectedServers(): string[] {
    const names: string[] = [];
    for (const [name, conn] of this.servers) {
      if (conn.connected) {
        names.push(name);
      }
    }
    return names;
  }

  private async initializeServer(serverName: string): Promise<void> {
    const connection = this.servers.get(serverName);
    if (!connection) return;

    const initRequestId = ++this.requestIdCounter;
    const initResponse = await this.sendRequest(connection, initRequestId, 'initialize', {
      protocolVersion: '2024-11-18',
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo: {
        name: 'DeeperCode',
        version: '1.0.0',
      },
    });

    const notifyMessage = {
      jsonrpc: '2.0' as const,
      method: 'notifications/initialized',
    };
    await connection.transport.send(notifyMessage);

    const toolsRequestId = ++this.requestIdCounter;
    const toolsResponse = await this.sendRequest(connection, toolsRequestId, 'tools/list', {});

    const toolsResult = toolsResponse.result as Record<string, unknown> | undefined;
    if (toolsResult?.tools && Array.isArray(toolsResult.tools)) {
      connection.tools = toolsResult.tools as MCPTool[];
    }

    this.eventbus.emit(Events.MCP_TOOLS_DISCOVERED, {
      serverName,
      toolCount: connection.tools.length,
      tools: connection.tools.map((t) => t.name),
    });
  }

  private async sendRequest(
    connection: ServerConnection,
    requestId: number,
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number = 30000,
  ): Promise<JSONRPCResponse> {
    const request = {
      jsonrpc: '2.0' as const,
      id: requestId,
      method,
      params,
    };

    const responsePromise = new Promise<JSONRPCResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      const cleanup = connection.transport.onMessage((message: JSONRPCMessage) => {
        if ('id' in message && message.id === requestId) {
          clearTimeout(timeout);
          cleanup();
          resolve(message as JSONRPCResponse);
        }
      });
    });

    await connection.transport.send(request);
    return responsePromise;
  }

  private handleMessage(_serverName: string, _message: JSONRPCMessage): void {
    // Messages are handled through the request/response pattern in sendRequest
  }
}
