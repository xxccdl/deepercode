import type { MCPServerConfig, JSONRPCMessage, MCPTransport } from './types.js';

export class SSETransport implements MCPTransport {
  private url: string = '';
  private headers: Record<string, string> = {};
  private messageHandlers: Array<(message: JSONRPCMessage) => void> = [];
  private connected: boolean = false;
  private abortController: AbortController | null = null;

  async connect(config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('SSETransport requires a URL');
    }

    this.url = config.url;
    this.headers = config.headers || {};
    this.abortController = new AbortController();

    this.connected = true;

    this.establishSSEConnection();
  }

  private async establishSSEConnection(): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...this.headers,
        },
        signal: this.abortController!.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('SSE response has no readable body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (this.connected) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventData = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventData += line.slice(6);
          } else if (line === '' && eventData) {
            try {
              const message = JSON.parse(eventData) as JSONRPCMessage;
              for (const handler of this.messageHandlers) {
                handler(message);
              }
            } catch {
              // Ignore non-JSON SSE data
            }
            eventData = '';
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      this.connected = false;
      for (const handler of this.messageHandlers) {
        handler({
          jsonrpc: '2.0',
          method: 'error',
          params: { message: String(error) },
        });
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('SSETransport not connected');
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(message),
      signal: this.abortController!.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE POST failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as JSONRPCMessage;
    for (const handler of this.messageHandlers) {
      handler(data);
    }
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
    this.connected = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
