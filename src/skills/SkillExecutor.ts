import type { Skill, SkillExecutionResult } from './types.js';

interface ExecutionContext {
  skill: Skill;
  params: Record<string, unknown>;
  env: Record<string, string>;
}

export class SkillExecutor {
  async execute(skill: Skill, context: Record<string, unknown>): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      let output = '';

      if (skill.code) {
        const codeResult = await this.runCode(skill.code, {
          skill,
          params: context,
          env: process.env as Record<string, string>,
        });
        output += codeResult;
      }

      if (!output) {
        output = `Skill "${skill.meta.name}" instructions ready for AI processing.\n`;
        output += `Description: ${skill.meta.description}\n`;
        output += `---\n${skill.content}\n---`;
      }

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        error: errMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  async runCode(code: string, ctx: ExecutionContext): Promise<string> {
    const lines: string[] = [];

    const sandbox = {
      console: {
        log: (...args: unknown[]) => {
          lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        },
        warn: (...args: unknown[]) => {
          lines.push('[WARN] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        },
        error: (...args: unknown[]) => {
          lines.push('[ERROR] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        },
      },
      skill: ctx.skill,
      params: ctx.params,
      env: ctx.env,
      fetch: globalThis.fetch,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      JSON: JSON,
      Math: Math,
      Date: Date,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Map: Map,
      Set: Set,
      RegExp: RegExp,
      Error: Error,
      Promise: Promise,
    };

    try {
      const wrappedCode = `
        return (async () => {
          ${code}
        })();
      `;

      const fn = new Function(
        ...Object.keys(sandbox),
        wrappedCode,
      );

      const result = await fn(...Object.values(sandbox));

      if (result !== undefined && result !== null) {
        lines.push(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      }

      return lines.join('\n');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return `Code execution error: ${errMsg}\n${lines.join('\n')}`;
    }
  }
}
