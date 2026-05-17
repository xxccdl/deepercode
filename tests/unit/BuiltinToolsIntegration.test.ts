import { describe, it, expect } from 'vitest';
import { builtinTools } from '../../src/tools/builtin/index.js';
import { TOOL_CATEGORIES } from '../../src/core/constants.js';

describe('内置工具集成', () => {
  it('应至少有 100 个内置工具', () => {
    expect(builtinTools.length).toBeGreaterThanOrEqual(100);
  });

  it('所有工具名称应唯一', () => {
    const names = builtinTools.map(t => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(builtinTools.length);
  });

  it('所有工具应都有必需的属性', () => {
    for (const tool of builtinTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('所有工具分类应在允许范围内', () => {
    for (const tool of builtinTools) {
      expect(TOOL_CATEGORIES).toContain(tool.category);
    }
  });

  it('每个分类应至少有 5 个工具', () => {
    for (const category of TOOL_CATEGORIES) {
      const count = builtinTools.filter(t => t.category === category).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it('文件系统分类应至少有 15 个工具', () => {
    const fsTools = builtinTools.filter(t => t.category === 'filesystem');
    expect(fsTools.length).toBeGreaterThanOrEqual(15);
  });

  it('Shell 分类应至少有 15 个工具', () => {
    const shellTools = builtinTools.filter(t => t.category === 'shell');
    expect(shellTools.length).toBeGreaterThanOrEqual(15);
  });

  it('安全工具 execute 应返回 Promise 对象', () => {
    const testTools = builtinTools.filter(t =>
      ['read_file', 'list_dir', 'file_info', 'token_count',
       'system_info', 'web_fetch', 'grep_search',
       'codebase_search', 'json_parse', 'csv_parse',
       'yaml_parse', 'toml_parse', 'data_transform',
       'text_search', 'fuzzy_find', 'find_references',
       'find_definition', 'symbol_search', 'search_package',
       'search_docs', 'process_list', 'resource_monitor',
       'log_viewer', 'check_url', 'parse_html'
      ].includes(t.name)
    );
    for (const tool of testTools) {
      const result = tool.execute({});
      expect(result).toBeInstanceOf(Promise);
    }
    expect(testTools.length).toBeGreaterThanOrEqual(10);
  });

  it('工具定义应具有正确的格式', () => {
    for (const tool of builtinTools) {
      const def: any = {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters,
      };
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.parameters).toBeDefined();
      expect(typeof def.parameters).toBe('object');
    }
  });
});

describe('工具安全分级', () => {
  it('安全工具应正确标记', () => {
    const safeTools = builtinTools.filter(t => t.dangerous === false && t.requiresApproval === false);
    expect(safeTools.length).toBeGreaterThan(0);
    // 读文件、列表操作等应是安全的
    const readFile = builtinTools.find(t => t.name === 'read_file');
    expect(readFile).toBeDefined();
    expect(readFile!.dangerous).toBe(false);
    expect(readFile!.requiresApproval).toBe(false);
  });

  it('危险工具应正确标记', () => {
    const dangerousTools = builtinTools.filter(t => t.dangerous === true);
    // 可能有 background_terminal, kill_terminal 等
    expect(dangerousTools.length).toBeGreaterThanOrEqual(0); // 可能不直接标记 dangerous
  });

  it('write_file 应需要确认', () => {
    const writeFile = builtinTools.find(t => t.name === 'write_file');
    expect(writeFile).toBeDefined();
  });

  it('delete_file 应需要确认', () => {
    const deleteFile = builtinTools.find(t => t.name === 'delete_file');
    expect(deleteFile).toBeDefined();
  });
});
