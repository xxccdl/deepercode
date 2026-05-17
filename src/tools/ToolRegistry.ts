import { EventBus, globalEventBus } from '../core/eventbus.js';
import type { Tool, ToolDefinition } from './tool-types.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus = globalEventBus) {
    this.eventBus = eventBus;
  }

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具已注册: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.eventBus.emit('tool:registered', { name: tool.name, category: tool.category });
  }

  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  unregister(name: string): void {
    if (this.tools.delete(name)) {
      this.eventBus.emit('tool:unregistered', { name });
    }
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): Tool[] {
    return this.getAll().filter(t => t.category === category);
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      parameters: t.parameters,
      dangerous: t.dangerous,
      requiresApproval: t.requiresApproval,
    }));
  }

  count(): number {
    return this.tools.size;
  }

  categories(): string[] {
    return [...new Set(this.getAll().map(t => t.category))];
  }

  clear(): void {
    this.tools.clear();
    this.eventBus.emit('tool:cleared');
  }
}
