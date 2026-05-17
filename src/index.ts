export { defaultTheme, type Theme } from './ui/themes/default.ts';
export { darkTheme } from './ui/themes/dark.ts';
export { lightTheme } from './ui/themes/light.ts';

export { Spinner } from './ui/Spinner.tsx';
export { MessageBubble } from './ui/MessageBubble.tsx';
export { ToolCallCard } from './ui/ToolCallCard.tsx';
export { DiffView } from './ui/DiffView.tsx';
export { FilePreview } from './ui/FilePreview.tsx';
export { AgentTree } from './ui/AgentTree.tsx';
export { ConfirmDialog } from './ui/ConfirmDialog.tsx';
export { StatusBar } from './ui/StatusBar.tsx';
export { InputBox } from './ui/InputBox.tsx';
export { ChatView } from './ui/ChatView.tsx';
export { App } from './ui/App.tsx';

export { eventbus, EventBusEvents, type ContextUpdatedPayload, type MessagePayload, type ToolCallPayload, type DiffPayload, type AgentPayload } from './core/eventbus.ts';
export { loadConfig, saveConfig, getConfig, updateConfig, resetConfig, getConfigValue, setConfigValue, getApiKey, getModel, getBaseUrl, type DeeperConfig, type MCPConfigEntry, type SkillConfigEntry } from './core/config.ts';
export { DEEPER_VERSION, DEEPER_NAME, DEEPER_HOME, DEEPER_CONFIG_FILE, DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_BASE_URL, TOOL_CATEGORIES, AGENT_MAX_SUB_AGENTS, CONTEXT_MAX_TOKENS, MCP_CONNECTION_TIMEOUT_MS } from './core/constants.ts';
export type { ToolCategory } from './core/constants.ts';
export { type JSONSchema, type ToolParameter, type ToolDefinition, type ToolResult, type ToolExecutor, type Tool, type ToolCall, type ToolCallResult, type ToolSafetyLevel, TOOL_SAFETY_MAP } from './tools/tool-types.ts';
export { type DeepSeekMessage, type DeepSeekToolCall, type DeepSeekToolDefinition, type DeepSeekRequest, type DeepSeekResponse, type DeepSeekStreamChunk, type ChatMessage, type ToolCallRecord, type AgentInfo, type SlashCommand, SLASH_COMMANDS } from './model/types.ts';

export { bootstrap, checkNodeVersion, getVersionInfo, type BootstrapResult } from './cli/bootstrap.ts';
export { chat } from './cli/commands/chat.tsx';
export { run } from './cli/commands/run.ts';
