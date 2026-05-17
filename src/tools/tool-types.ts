export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: JSONSchema;
  dangerous?: boolean;
  requiresApproval?: boolean;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutor {
  execute(params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
}

export type Tool = ToolDefinition & ToolExecutor;

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  index?: number;
}

export interface ToolCallResult {
  callId: string;
  result: ToolResult;
  timestamp: number;
}

export type ToolSafetyLevel = 'safe' | 'confirm' | 'dangerous';

export const TOOL_SAFETY_MAP: Record<string, ToolSafetyLevel> = {
  read_file: 'safe', list_dir: 'safe', glob_find: 'safe', file_info: 'safe',
  grep_search: 'safe', text_search: 'safe', fuzzy_find: 'safe', regex_find: 'safe',
  find_references: 'safe', find_definition: 'safe', symbol_search: 'safe',
  search_package: 'safe', search_docs: 'safe', codebase_search: 'safe',
  token_count: 'safe', system_info: 'safe', process_list: 'safe',
  resource_monitor: 'safe', log_viewer: 'safe', bug_scan: 'safe',
  web_fetch: 'safe', web_search: 'safe', check_url: 'safe',
  parse_html: 'safe', http_request: 'safe',
  watch_file: 'safe', batch_read: 'safe', create_dir: 'safe',
  json_parse: 'safe', csv_parse: 'safe', xml_parse: 'safe', yaml_parse: 'safe', toml_parse: 'safe',
  data_validate: 'safe', data_diff: 'safe', hash_generate: 'safe', jwt_decode: 'safe',
  coverage_report: 'safe', config_manage: 'safe', notify_user: 'safe',
  format_code: 'safe', lint_code: 'safe', type_check: 'safe', code_metrics: 'safe',
  analyze_deps: 'safe', import_organizer: 'safe', parse_ast: 'safe',
  db_schema: 'safe',
  context_summarize: 'safe', prompt_template: 'safe',
  skill_create: 'safe', tool_create: 'safe', memory_store: 'safe',
  todo_manager: 'safe', subagent: 'safe',
  background_terminal: 'safe', list_terminals: 'safe', read_terminal: 'safe',
  send_keys: 'safe', send_ctrl_keys: 'safe', send_text: 'safe', kill_terminal: 'safe',
  terminal_screenshot: 'safe', terminal_resize: 'safe', check_status: 'safe', stop_command: 'safe',
  download_file: 'safe', api_call: 'safe', graphql_query: 'safe', websocket_connect: 'safe',

  write_file: 'safe', edit_file: 'safe',
  delete_file: 'confirm', move_file: 'confirm', copy_file: 'confirm', batch_write: 'safe',
  merge_files: 'confirm', diff_files: 'confirm',
  run_command: 'safe', run_async: 'safe', pipe_commands: 'safe',
  shell_script: 'confirm', npm_manage: 'confirm',
  project_init: 'confirm', build_project: 'confirm', run_test: 'confirm',
  docker_manage: 'confirm', env_manage: 'confirm',
  sql_query: 'confirm', sql_migrate: 'confirm', nosql_query: 'confirm',
  db_backup: 'confirm', db_restore: 'confirm', redis_command: 'confirm',
  encrypt_file: 'confirm', decrypt_file: 'confirm',
  template_render: 'confirm', chart_generate: 'confirm',
  secret_scan: 'confirm', vulnerability_check: 'confirm',
  orm_generate: 'confirm', generate_code: 'confirm', refactor_code: 'confirm',
  extract_function: 'confirm', data_transform: 'confirm', proxy_request: 'confirm',

  interactive_terminal: 'confirm',
  browser_action: 'confirm', screenshot_page: 'confirm',
};
