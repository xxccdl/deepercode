import { EventEmitter } from 'node:events';

export interface ContextUpdatedPayload {
  modelName: string;
  tokenCount: number;
  memoryUsage: number;
  uptime: number;
}

export interface MessagePayload {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
}

export interface ToolCallPayload {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface DiffPayload {
  filePath: string;
  oldContent: string;
  newContent: string;
}

export interface AgentPayload {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  parentId?: string;
  task: string;
  children?: AgentPayload[];
}

export const Events = {
  CONTEXT_UPDATED: 'context:updated',
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_STREAMING: 'message:streaming',
  TOOL_CALL_START: 'tool:call:start',
  TOOL_CALL_END: 'tool:call:end',
  FILE_DIFF: 'file:diff',
  AGENT_TREE_UPDATED: 'agent:tree:updated',
  APP_QUIT: 'app:quit',
  APP_CLEAR: 'app:clear',
  STATUS_UPDATE: 'status:update',
  CONFIG_CHANGED: 'config:changed',
  AGENT_STATUS_CHANGE: 'agent:status:change',
  AGENT_CREATED: 'agent:created',
  AGENT_THINKING: 'agent:thinking',
  AGENT_EXECUTING: 'agent:executing',
  AGENT_WAITING: 'agent:waiting',
  AGENT_COMPLETED: 'agent:completed',
  AGENT_FAILED: 'agent:failed',
  AGENT_CANCELLED: 'agent:cancelled',
  AGENT_LOOP_ITERATION: 'agent:loop:iteration',
  AGENT_LOOP_DETECTED: 'agent:loop:detected',
  AGENT_LOOP_LIMIT: 'agent:loop:limit',
  TOOL_CALL_ERROR: 'tool:call:error',
  ORCHESTRATOR_DECOMPOSE: 'orchestrator:decompose',
  ORCHESTRATOR_DISPATCH: 'orchestrator:dispatch',
  ORCHESTRATOR_AGGREGATE: 'orchestrator:aggregate',
  SUBAGENT_START: 'subagent:start',
  SUBAGENT_TIMEOUT: 'subagent:timeout',
  SUBAGENT_COMPLETE: 'subagent:complete',
  SUBAGENT_ERROR: 'subagent:error',
  POOL_ACQUIRE: 'pool:acquire',
  POOL_RELEASE: 'pool:release',
  POOL_QUEUE: 'pool:queue',
  CONTEXT_SUMMARIZED: 'context:summarized',
  CONTEXT_TOKEN_WARNING: 'context:token:warning',
  MCP_CONNECTED: 'mcp:connected',
  MCP_ERROR: 'mcp:error',
  MCP_DISCONNECTED: 'mcp:disconnected',
  MCP_TOOLS_DISCOVERED: 'mcp:tools:discovered',
  SKILL_LOADED: 'skill:loaded',
  SKILL_EXECUTED: 'skill:executed',
  SKILL_CREATED: 'skill:created',
  SKILL_TRIGGERED: 'skill:triggered',
} as const;

export const EventBusEvents = Events;

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  onContextUpdated(handler: (payload: ContextUpdatedPayload) => void): void {
    this.on(EventBusEvents.CONTEXT_UPDATED, handler);
  }

  emitContextUpdated(payload: ContextUpdatedPayload): void {
    this.emit(EventBusEvents.CONTEXT_UPDATED, payload);
  }

  onMessageSend(handler: (payload: { content: string }) => void): void {
    this.on(EventBusEvents.MESSAGE_SEND, handler);
  }

  emitMessageSend(payload: { content: string }): void {
    this.emit(EventBusEvents.MESSAGE_SEND, payload);
  }

  onMessageReceived(handler: (payload: MessagePayload) => void): void {
    this.on(EventBusEvents.MESSAGE_RECEIVED, handler);
  }

  emitMessageReceived(payload: MessagePayload): void {
    this.emit(EventBusEvents.MESSAGE_RECEIVED, payload);
  }

  onMessageStreaming(handler: (payload: { id: string; content: string; thinking?: string }) => void): void {
    this.on(EventBusEvents.MESSAGE_STREAMING, handler);
  }

  emitMessageStreaming(payload: { id: string; content: string; thinking?: string }): void {
    this.emit(EventBusEvents.MESSAGE_STREAMING, payload);
  }

  onToolCallStart(handler: (payload: ToolCallPayload) => void): void {
    this.on(EventBusEvents.TOOL_CALL_START, handler);
  }

  emitToolCallStart(payload: ToolCallPayload): void {
    this.emit(EventBusEvents.TOOL_CALL_START, payload);
  }

  onToolCallEnd(handler: (payload: ToolCallPayload) => void): void {
    this.on(EventBusEvents.TOOL_CALL_END, handler);
  }

  emitToolCallEnd(payload: ToolCallPayload): void {
    this.emit(EventBusEvents.TOOL_CALL_END, payload);
  }

  onFileDiff(handler: (payload: DiffPayload) => void): void {
    this.on(EventBusEvents.FILE_DIFF, handler);
  }

  emitFileDiff(payload: DiffPayload): void {
    this.emit(EventBusEvents.FILE_DIFF, payload);
  }

  onAgentTreeUpdated(handler: (payload: { agents: AgentPayload[] }) => void): void {
    this.on(EventBusEvents.AGENT_TREE_UPDATED, handler);
  }

  emitAgentTreeUpdated(payload: { agents: AgentPayload[] }): void {
    this.emit(EventBusEvents.AGENT_TREE_UPDATED, payload);
  }

  onAppQuit(handler: () => void): void {
    this.on(EventBusEvents.APP_QUIT, handler);
  }

  emitAppQuit(): void {
    this.emit(EventBusEvents.APP_QUIT);
  }

  onAppClear(handler: () => void): void {
    this.on(EventBusEvents.APP_CLEAR, handler);
  }

  emitAppClear(): void {
    this.emit(EventBusEvents.APP_CLEAR);
  }

  onStatusUpdate(handler: (payload: Partial<ContextUpdatedPayload>) => void): void {
    this.on(EventBusEvents.STATUS_UPDATE, handler);
  }

  emitStatusUpdate(payload: Partial<ContextUpdatedPayload>): void {
    this.emit(EventBusEvents.STATUS_UPDATE, payload);
  }

  onConfigChanged(handler: (payload: Record<string, unknown>) => void): void {
    this.on(EventBusEvents.CONFIG_CHANGED, handler);
  }

  emitConfigChanged(payload: Record<string, unknown>): void {
    this.emit(EventBusEvents.CONFIG_CHANGED, payload);
  }

  reset(): void {
    this.removeAllListeners();
  }
}

export const eventbus = EventBus.getInstance();
export const globalEventBus = eventbus;
