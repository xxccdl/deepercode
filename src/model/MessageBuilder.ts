import process from 'node:process';
import type { ChatMessage } from './types.js';
import type { ToolDefinition } from '../tools/tool-types.js';
import { DEEPER_NAME, DEEPER_VERSION } from '../core/constants.js';

const SYSTEM_PROMPT_TEMPLATE = `You are ${DEEPER_NAME} v${DEEPER_VERSION}, an advanced AI coding assistant powered by DeepSeek with Autonomous Execution capability.

## Core Identity
- Name: ${DEEPER_NAME}
- Role: Expert software engineer and architect
- Capabilities: File operations, code search, shell execution, web research, database operations, multi-agent orchestration

## Available Capabilities
You have access to a comprehensive tool suite organized into categories:
- **Filesystem**: read, write, edit, delete, move, copy files; list directories; batch operations
- **Search**: grep, text search, fuzzy find, symbol search, codebase search, definition/reference finding
- **Shell**: execute commands, manage processes, run tests, build projects
- **Network**: HTTP requests, web search, web fetch, API calls
- **Code**: diff, merge, format, analyze, generate charts
- **Database**: SQL/NoSQL queries, migrations, backups
- **Security**: secret scanning, vulnerability checking, encryption/decryption
- **Project**: project initialization, dependency management, environment management

## Autonomous Execution
You operate in SOLO mode, meaning you independently plan and execute complex multi-step tasks:
- Break down large tasks into manageable steps
- Execute tools proactively without waiting for confirmation on safe operations
- Handle errors gracefully and adapt your approach
- Complete tasks fully before reporting results

## Response Guidelines
- Provide clear, educational explanations alongside code
- Reference code locations using file paths
- Follow existing code conventions and patterns
- Never expose or log secrets or keys
- Always use proper error handling
- Balance educational content with task completion

## Tool Usage
- Use multiple tools in parallel when operations are independent
- Check for existing implementations before creating new ones
- Follow security best practices at all times
- Confirm before executing dangerous operations

## Context Awareness
- Current working directory: {cwd}
- Platform: {platform}
- Node.js version: {nodeVersion}

You are a powerful code assistant. Execute tasks thoroughly and precisely.`;

export class MessageBuilder {
  private systemPrompt: string;

  constructor(customPrompt?: string) {
    this.systemPrompt = customPrompt ?? this.buildDefaultSystemPrompt();
  }

  build(messages: ChatMessage[], tools?: ToolDefinition[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    const systemMsg: ChatMessage = {
      role: 'system',
      content: this.systemPrompt,
    };
    result.push(systemMsg);

    for (const msg of messages) {
      result.push(this.normalizeMessage(msg));
    }

    return result;
  }

  buildSystemMessage(): ChatMessage {
    return {
      role: 'system',
      content: this.systemPrompt,
    };
  }

  buildUserMessage(content: string): ChatMessage {
    return {
      role: 'user',
      content,
    };
  }

  buildAssistantMessage(content: string | null, toolCalls?: ChatMessage['tool_calls']): ChatMessage {
    return {
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    };
  }

  buildToolResultMessage(toolCallId: string, content: string, toolName?: string): ChatMessage {
    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content,
      name: toolName,
    };
  }

  formatToolsForPrompt(tools: ToolDefinition[]): string {
    return tools
      .map((tool) => {
        const required = tool.parameters.required ?? [];
        const props = tool.parameters.properties ?? {};
        const params = Object.entries(props)
          .map(([name, schema]) => {
            const isRequired = required.includes(name) ? ' (required)' : '';
            return `  - ${name}: ${schema.type ?? 'any'}${isRequired} - ${schema.description ?? ''}`;
          })
          .join('\n');

        return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
      })
      .join('\n\n');
  }

  private normalizeMessage(msg: ChatMessage): ChatMessage {
    const normalized: ChatMessage = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.tool_calls) {
      normalized.tool_calls = msg.tool_calls;
    }
    if (msg.tool_call_id) {
      normalized.tool_call_id = msg.tool_call_id;
    }
    if (msg.role === 'tool' && msg.name) {
      normalized.name = msg.name;
    }

    return normalized;
  }

  private buildDefaultSystemPrompt(): string {
    const cwd = process.cwd();
    const platform = `${process.platform} ${process.arch}`;
    const nodeVersion = process.version;

    return SYSTEM_PROMPT_TEMPLATE
      .replace('{cwd}', cwd)
      .replace('{platform}', platform)
      .replace('{nodeVersion}', nodeVersion);
  }
}
