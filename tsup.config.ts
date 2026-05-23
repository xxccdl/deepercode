import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  splitting: false,
  skipNodeModulesBundle: true,
  noExternal: ['cheerio', 'csv-parse', 'csv-parse/sync', 'diff', 'toml', 'open', 'ws'],
});
