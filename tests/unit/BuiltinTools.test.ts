import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('GrepSearch 工具', () => {
  let testDir: string;

  function setup() {
    testDir = join(tmpdir(), `deeper-grep-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'file1.ts'), 'export function hello() {\n  return "world";\n}\n', 'utf-8');
    writeFileSync(join(testDir, 'file2.ts'), 'const x = hello();\nconst y = 42;\n', 'utf-8');
    mkdirSync(join(testDir, 'subdir'), { recursive: true });
    writeFileSync(join(testDir, 'subdir', 'nested.ts'), 'import { test } from "vitest";', 'utf-8');
    return testDir;
  }

  function cleanup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  }

  it('grep_search 应找到匹配的行', async () => {
    const dir = setup();
    try {
      const { grep_search } = await import('../../src/tools/builtin/search/grep_search.js');
      const result = await grep_search.execute({ pattern: 'hello', dir_path: dir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('hello');
    } finally {
      cleanup();
    }
  });

  it('grep_search 不匹配时应返回提示', async () => {
    const dir = setup();
    try {
      const { grep_search } = await import('../../src/tools/builtin/search/grep_search.js');
      const result = await grep_search.execute({ pattern: 'NONEXISTENT_PATTERN', dir_path: dir });
      expect(result.success).toBe(true);
      expect(result.output).not.toContain('NONEXISTENT_PATTERN');
    } finally {
      cleanup();
    }
  });
});

describe('RunCommand 工具', () => {
  it('run_command 应执行简单命令', async () => {
    const { run_command } = await import('../../src/tools/builtin/shell/run_command.js');
    const result = await run_command.execute({ command: 'echo hello_from_test' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello_from_test');
  });

  it('run_command 应执行 node --version', async () => {
    const { run_command } = await import('../../src/tools/builtin/shell/run_command.js');
    const result = await run_command.execute({ command: 'node --version' });
    expect(result.success).toBe(true);
    expect(result.output).toMatch(/v\d+/);
  });

  it('run_command 错误命令应返回失败', async () => {
    const { run_command } = await import('../../src/tools/builtin/shell/run_command.js');
    const result = await run_command.execute({ command: 'nonexistent_command_xyz' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('JSON/YAML 数据工具', () => {
  it('json_parse 应正确解析 JSON', async () => {
    const { json_parse } = await import('../../src/tools/builtin/data/json_parse.js');
    const result = await json_parse.execute({ content: '{"name":"deeper","version":"1.0.0"}' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('deeper');
  });

  it('json_parse 对无效 JSON 应返回错误', async () => {
    const { json_parse } = await import('../../src/tools/builtin/data/json_parse.js');
    const result = await json_parse.execute({ content: 'not valid json' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('yaml_parse 应正确解析 YAML', async () => {
    const { yaml_parse } = await import('../../src/tools/builtin/data/yaml_parse.js');
    const result = await yaml_parse.execute({ content: 'name: deeper\nversion: 1.0.0' });
    expect(result.success).toBe(true);
  });

  it('csv_parse 应正确解析 CSV', async () => {
    const { csv_parse } = await import('../../src/tools/builtin/data/csv_parse.js');
    const result = await csv_parse.execute({ content: 'name,version\ndeeper,1.0.0' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('deeper');
  });
});

describe('AI 工具', () => {
  it('token_count 应正确计数', async () => {
    const { token_count } = await import('../../src/tools/builtin/ai/token_count.js');
    const result = await token_count.execute({ text: 'Hello 你好 world' });
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('memory_store 应存储记忆', async () => {
    const { memory_store } = await import('../../src/tools/builtin/ai/memory_store.js');
    const result = await memory_store.execute({ action: 'set', key: 'test_key', value: 'test_value' });
    expect(result.success).toBe(true);
  });
});

describe('系统工具', () => {
  it('system_info 应返回系统信息', async () => {
    const { system_info } = await import('../../src/tools/builtin/system/system_info.js');
    const result = await system_info.execute({});
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('process_list 应返回进程列表', async () => {
    const { process_list } = await import('../../src/tools/builtin/system/process_list.js');
    const result = await process_list.execute({});
    expect(result.success).toBe(true);
  });
});
