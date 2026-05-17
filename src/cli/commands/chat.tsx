import { render } from 'ink';
import { App } from '../../ui/App.tsx';
import { bootstrap } from '../bootstrap.ts';

interface ChatOptions {
  model?: string;
  apiKey?: string;
  verbose?: boolean;
  autoRun?: string;
}

export async function chat(opts: ChatOptions = {}): Promise<void> {
  const result = await bootstrap();

  if (!result.success) {
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
    }
    process.exit(1);
  }

  for (const warn of result.warnings) {
    console.warn(`⚠ ${warn}`);
  }

  const model = opts.model || result.config.model;
  const apiKey = opts.apiKey || result.config.apiKey;

  const { waitUntilExit } = render(
    <App
      apiKey={apiKey}
      model={model}
      verbose={opts.verbose}
      autoRun={opts.autoRun}
    />,
  );

  await waitUntilExit();
}
