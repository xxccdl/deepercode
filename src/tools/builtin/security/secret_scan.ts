import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../tool-types.js';

export const secret_scan: Tool = {
  name: 'secret_scan',
  description: '扫描代码中的密钥和敏感信息',
  category: 'security',
  parameters: {
    type: 'object',
    properties: {
      dir_path: { type: 'string', description: '扫描目录' },
      file_path: { type: 'string', description: '扫描文件' },
      max_results: { type: 'number', description: '最大结果数' },
    },
    required: [],
  },
  dangerous: false,
  requiresApproval: true,
  async execute(params) {
    try {
      const dirPath = params.dir_path as string | undefined;
      const filePath = params.file_path as string | undefined;
      const maxResults = (params.max_results as number) ?? 100;

      const patterns: [string, RegExp][] = [
        ['API Key', /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]([^'"]+)['"]/gi],
        ['Password', /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi],
        ['Token', /(?:token|jwt|bearer)\s*[:=]\s*['"]([^'"]+)['"]/gi],
        ['Secret', /(?:secret|secret[_-]key)\s*[:=]\s*['"]([^'"]+)['"]/gi],
        ['Private Key', /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g],
        ['AWS Key', /(?:AKIA[0-9A-Z]{16})/g],
        ['GitHub Token', /(?:gh[pousr]_[A-Za-z0-9_]{36,})/g],
      ];

      const fg = await import('fast-glob');
      let files: string[];
      if (filePath) {
        files = [resolve(filePath)];
      } else {
        const target = dirPath ? resolve(dirPath) : process.cwd();
        files = await fg.default('**/*.{ts,js,tsx,jsx,py,yml,yaml,json,env,properties,xml,toml}', {
          cwd: target,
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
      }

      const results: string[] = [];
      for (const fp of files.slice(0, 500)) {
        if (results.length >= maxResults) break;
        try {
          const stat = await import('node:fs').then(m => m.statSync(fp));
          if (stat.size > 1048576) continue;
          const content = readFileSync(fp, 'utf-8');
          for (const [type, regex] of patterns) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(content)) !== null && results.length < maxResults) {
              const line = content.slice(0, match.index).split('\n').length;
              const redacted = match[0].replace(/[:=]\s*['"][^'"]+/g, '=****');
              results.push(`${fp}:${line}: [${type}] ${redacted.slice(0, 120)}`);
            }
          }
        } catch { /* skip */ }
      }

      const output = results.length > 0
        ? `发现 ${results.length} 个疑似敏感信息:\n\n${results.join('\n')}\n\n建议立即处理这些信息！`
        : '未发现疑似敏感信息';

      return {
        success: true,
        output,
        metadata: { count: results.length, scanned: files.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
