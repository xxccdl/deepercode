import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { MCPServerConfig, JSONRPCMessage, MCPTransport } from './types.js';

export class StdioTransport implements MCPTransport {
  private process: ChildProcess | null = null;
  private messageHandlers: Array<(message: JSONRPCMessage) => void> = [];
  private connected: boolean = false;
  private buffer: string = '';

  async connect(config: MCPServerConfig): Promise<void> {
    if (!config.command) {
      throw new Error('StdioTransport requires a command');
    }

    const env = {
      ...process.env,
      ...config.env,
    };

    this.process = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: true,
    });

    const rl = createInterface({ input: this.process.stdout! });

    rl.on('line', (line: string) => {
      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        for (const handler of this.messageHandlers) {
          handler(message);
        }
      } catch {
        this.buffer += line;
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      try {
        const message = JSON.parse(text) as JSONRPCMessage;
        for (const handler of this.messageHandlers) {
          handler(message);
        }
      } catch {
        // MCP stderr is for logging, not JSON-RPC
      }
    });

    this.process.on('exit', (code) => {
      this.connected = false;
      if (code !== 0 && code !== null) {
        for (const handler of this.messageHandlers) {
          handler({
            jsonrpc: '2.0',
            method: 'exit',
            params: { code },
          });
        }
      }
    });

    this.process.on('error', (err) => {
      this.connected = false;
      for (const handler of this.messageHandlers) {
        handler({
          jsonrpc: '2.0',
          method: 'error',
          params: { message: err.message },
        });
      }
    });

    this.connected = true;
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.process || !this.connected) {
      throw new Error('StdioTransport not connected');
    }

    const line = JSON.stringify(message) + '\n';
    await new Promise<void>((resolve, reject) => {
      this.process!.stdin!.write(line, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  onMessage(handler: (message: JSONRPCMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx !== -1) {
        this.messageHandlers.splice(idx, 1);
      }
    };
  }

  disconnect(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.process !== null && !this.process.killed;
  }
}
