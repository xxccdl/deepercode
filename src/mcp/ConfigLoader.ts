import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DEEPER_MCP_FILE } from '../core/constants.js';
import type { MCPServerConfig } from './types.js';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || DEEPER_MCP_FILE;
  }

  async load(): Promise<MCPServerConfig[]> {
    if (!existsSync(this.configPath)) {
      return [];
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        return this.validateConfigs(parsed);
      }

      if (parsed && parsed.mcpServers) {
        return this.validateConfigs(parsed.mcpServers);
      }

      return [];
    } catch {
      return [];
    }
  }

  async loadSingle(name: string): Promise<MCPServerConfig | null> {
    const configs = await this.load();
    return configs.find((c) => c.name === name) || null;
  }

  private validateConfigs(raw: unknown[]): MCPServerConfig[] {
    const valid: MCPServerConfig[] = [];

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;

      const obj = item as Record<string, unknown>;

      if (!obj.name || typeof obj.name !== 'string') continue;
      if (!obj.type || (obj.type !== 'stdio' && obj.type !== 'sse')) continue;

      const config: MCPServerConfig = {
        name: obj.name,
        type: obj.type as 'stdio' | 'sse',
        command: typeof obj.command === 'string' ? obj.command : undefined,
        args: Array.isArray(obj.args) ? obj.args.map(String) : undefined,
        url: typeof obj.url === 'string' ? obj.url : undefined,
        headers: typeof obj.headers === 'object' && obj.headers
          ? obj.headers as Record<string, string>
          : undefined,
        env: typeof obj.env === 'object' && obj.env
          ? obj.env as Record<string, string>
          : undefined,
      };

      if (config.type === 'stdio' && !config.command) continue;
      if (config.type === 'sse' && !config.url) continue;

      valid.push(config);
    }

    return valid;
  }
}
