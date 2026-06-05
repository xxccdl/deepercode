import type { Tool } from '../tool-types.js';

import { read_file } from './filesystem/read_file.js';
import { write_file } from './filesystem/write_file.js';
import { edit_file } from './filesystem/edit_file.js';
import { delete_file } from './filesystem/delete_file.js';
import { list_dir } from './filesystem/list_dir.js';
import { glob_find } from './filesystem/glob_find.js';
import { move_file } from './filesystem/move_file.js';
import { copy_file } from './filesystem/copy_file.js';
import { create_dir } from './filesystem/create_dir.js';
import { file_info } from './filesystem/file_info.js';
import { watch_file } from './filesystem/watch_file.js';
import { batch_read } from './filesystem/batch_read.js';
import { batch_write } from './filesystem/batch_write.js';
import { diff_files } from './filesystem/diff_files.js';
import { merge_files } from './filesystem/merge_files.js';

import { grep_search } from './search/grep_search.js';
import { codebase_search } from './search/codebase_search.js';
import { symbol_search } from './search/symbol_search.js';
import { find_references } from './search/find_references.js';
import { find_definition } from './search/find_definition.js';
import { text_search } from './search/text_search.js';
import { fuzzy_find } from './search/fuzzy_find.js';
import { regex_find } from './search/regex_find.js';
import { search_package } from './search/search_package.js';
import { search_docs } from './search/search_docs.js';

import { run_command } from './shell/run_command.js';
import { run_async } from './shell/run_async.js';
import { check_status } from './shell/check_status.js';
import { stop_command } from './shell/stop_command.js';
import { pipe_commands } from './shell/pipe_commands.js';
import { shell_script } from './shell/shell_script.js';
import { background_terminal } from './shell/background_terminal.js';
import { send_keys } from './shell/send_keys.js';
import { send_ctrl_keys } from './shell/send_ctrl_keys.js';
import { send_text } from './shell/send_text.js';
import { terminal_screenshot } from './shell/terminal_screenshot.js';
import { terminal_resize } from './shell/terminal_resize.js';
import { list_terminals, read_terminal } from './shell/list_terminals.js';
import { kill_terminal } from './shell/kill_terminal.js';
import { interactive_terminal } from './shell/interactive_terminal.js';

import { web_fetch } from './network/web_fetch.js';
import { web_search } from './network/web_search.js';
import { http_request } from './network/http_request.js';
import { download_file } from './network/download_file.js';
import { api_call } from './network/api_call.js';
import { graphql_query } from './network/graphql_query.js';
import { websocket_connect } from './network/websocket_connect.js';
import { check_url } from './network/check_url.js';
import { screenshot_page } from './network/screenshot_page.js';
import { parse_html } from './network/parse_html.js';
import { browser_action } from './network/browser_action.js';
import { proxy_request } from './network/proxy_request.js';

import { parse_ast } from './code/parse_ast.js';
import { format_code } from './code/format_code.js';
import { lint_code } from './code/lint_code.js';
import { type_check } from './code/type_check.js';
import { generate_code } from './code/generate_code.js';
import { refactor_code } from './code/refactor_code.js';
import { extract_function } from './code/extract_function.js';
import { analyze_deps } from './code/analyze_deps.js';
import { import_organizer } from './code/import_organizer.js';
import { code_metrics } from './code/code_metrics.js';
import { bug_scan } from './code/bug_scan.js';

import { sql_query } from './database/sql_query.js';
import { sql_migrate } from './database/sql_migrate.js';
import { nosql_query } from './database/nosql_query.js';
import { db_schema } from './database/db_schema.js';
import { db_backup } from './database/db_backup.js';
import { db_restore } from './database/db_restore.js';
import { redis_command } from './database/redis_command.js';
import { orm_generate } from './database/orm_generate.js';

import { json_parse } from './data/json_parse.js';
import { csv_parse } from './data/csv_parse.js';
import { xml_parse } from './data/xml_parse.js';
import { yaml_parse } from './data/yaml_parse.js';
import { toml_parse } from './data/toml_parse.js';
import { data_transform } from './data/data_transform.js';
import { data_validate } from './data/data_validate.js';
import { data_diff } from './data/data_diff.js';
import { template_render } from './data/template_render.js';
import { chart_generate } from './data/chart_generate.js';

import { secret_scan } from './security/secret_scan.js';
import { encrypt_file } from './security/encrypt_file.js';
import { decrypt_file } from './security/decrypt_file.js';
import { hash_generate } from './security/hash_generate.js';
import { jwt_decode } from './security/jwt_decode.js';
import { vulnerability_check } from './security/vulnerability_check.js';

import { npm_manage } from './project/npm_manage.js';
import { project_init } from './project/project_init.js';
import { build_project } from './project/build_project.js';
import { run_test } from './project/run_test.js';
import { coverage_report } from './project/coverage_report.js';
import { env_manage } from './project/env_manage.js';
import { config_manage } from './project/config_manage.js';
import { docker_manage } from './project/docker_manage.js';

import { token_count } from './ai/token_count.js';
import { context_summarize } from './ai/context_summarize.js';
import { prompt_template } from './ai/prompt_template.js';
import { skill_create } from './ai/skill_create.js';
import { rules_manager } from './ai/rules_manager.js';
import { tool_create } from './ai/tool_create.js';
import { memory_store } from './ai/memory_store.js';
import { todo_manager } from './ai/todo_manager.js';
import { subagent, setSubagentRunner } from './ai/subagent.js';

import { process_list } from './system/process_list.js';
import { system_info } from './system/system_info.js';
import { resource_monitor } from './system/resource_monitor.js';
import { notify_user } from './system/notify_user.js';
import { log_viewer } from './system/log_viewer.js';
import { ask_user, setAskUserFn } from './system/ask_user.js';

export const builtinTools: Tool[] = [
  read_file,
  write_file,
  edit_file,
  delete_file,
  list_dir,
  glob_find,
  move_file,
  copy_file,
  create_dir,
  file_info,
  watch_file,
  batch_read,
  batch_write,
  diff_files,
  merge_files,

  grep_search,
  codebase_search,
  symbol_search,
  find_references,
  find_definition,
  text_search,
  fuzzy_find,
  regex_find,
  search_package,
  search_docs,

  run_command,
  run_async,
  check_status,
  stop_command,
  pipe_commands,
  shell_script,
  background_terminal,
  send_keys,
  send_ctrl_keys,
  send_text,
  terminal_screenshot,
  terminal_resize,
  list_terminals,
  read_terminal,
  kill_terminal,
  interactive_terminal,

  web_fetch,
  web_search,
  http_request,
  download_file,
  api_call,
  graphql_query,
  websocket_connect,
  check_url,
  screenshot_page,
  parse_html,
  browser_action,
  proxy_request,

  parse_ast,
  format_code,
  lint_code,
  type_check,
  generate_code,
  refactor_code,
  extract_function,
  analyze_deps,
  import_organizer,
  code_metrics,
  bug_scan,

  sql_query,
  sql_migrate,
  nosql_query,
  db_schema,
  db_backup,
  db_restore,
  redis_command,
  orm_generate,

  json_parse,
  csv_parse,
  xml_parse,
  yaml_parse,
  toml_parse,
  data_transform,
  data_validate,
  data_diff,
  template_render,
  chart_generate,

  secret_scan,
  encrypt_file,
  decrypt_file,
  hash_generate,
  jwt_decode,
  vulnerability_check,

  npm_manage,
  project_init,
  build_project,
  run_test,
  coverage_report,
  env_manage,
  config_manage,
  docker_manage,

  token_count,
  context_summarize,
  prompt_template,
  skill_create,
  rules_manager,
  tool_create,
  memory_store,
  todo_manager,
  subagent,

  process_list,
  system_info,
  resource_monitor,
  notify_user,
  log_viewer,
  ask_user,
];

export { setSubagentRunner, setAskUserFn };
