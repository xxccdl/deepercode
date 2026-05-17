import { SkillRegistry } from './SkillRegistry.js';
import { SkillLoader } from './SkillLoader.js';
import { SkillExecutor } from './SkillExecutor.js';
import { SkillCreator } from './SkillCreator.js';
import { SkillTrigger } from './SkillTrigger.js';
import { EventBus, Events } from '../core/eventbus.js';
import type { Skill, SkillExecutionResult } from './types.js';

export class SkillEngine {
  private registry: SkillRegistry;
  private loader: SkillLoader;
  private executor: SkillExecutor;
  private creator: SkillCreator;
  private trigger: SkillTrigger;
  private eventbus: EventBus;

  constructor(eventbus?: EventBus) {
    this.registry = new SkillRegistry();
    this.loader = new SkillLoader();
    this.executor = new SkillExecutor();
    this.creator = new SkillCreator();
    this.trigger = new SkillTrigger(this.registry);
    this.eventbus = eventbus || new EventBus();
  }

  getRegistry(): SkillRegistry {
    return this.registry;
  }

  getLoader(): SkillLoader {
    return this.loader;
  }

  getTrigger(): SkillTrigger {
    return this.trigger;
  }

  async loadAll(): Promise<number> {
    const results = await this.loader.loadAll();
    let count = 0;

    for (const result of results) {
      this.registry.register(result.skill);
      count++;
      this.eventbus.emit(Events.SKILL_LOADED, {
        name: result.skill.meta.name,
        source: result.source,
        hasCode: !!result.skill.code,
      });
    }

    return count;
  }

  async reload(): Promise<number> {
    this.registry.clear();
    return this.loadAll();
  }

  async execute(name: string, context: Record<string, unknown>): Promise<SkillExecutionResult> {
    const skill = this.registry.get(name);
    if (!skill) {
      return {
        success: false,
        output: '',
        error: `Skill not found: ${name}`,
        duration: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await this.executor.execute(skill, context);
      const duration = Date.now() - startTime;

      this.eventbus.emit(Events.SKILL_EXECUTED, {
        name: skill.meta.name,
        success: result.success,
        duration,
      });

      return { ...result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        error: errMsg,
        duration,
      };
    }
  }

  async createSkill(
    name: string,
    description: string,
    content: string,
    code?: string,
  ): Promise<Skill> {
    const skill = await this.creator.create({
      meta: {
        name,
        description,
        version: '1.0.0',
        author: 'DeeperCode AI',
        triggers: [],
        tools: [],
        dependencies: [],
      },
      content,
      code,
    });

    this.registry.register(skill);

    this.eventbus.emit(Events.SKILL_CREATED, {
      name: skill.meta.name,
      description: skill.meta.description,
    });

    return skill;
  }

  matchTriggers(input: string): Skill[] {
    const matches = this.trigger.match(input);
    for (const skill of matches) {
      this.eventbus.emit(Events.SKILL_TRIGGERED, {
        name: skill.meta.name,
        input: input.slice(0, 100),
      });
    }
    return matches;
  }

  getSystemPrompt(context?: Record<string, unknown>): string {
    const allSkills = this.registry.getAll();
    if (allSkills.length === 0) return '';

    let prompt = 'Available Skills:\n\n';
    for (const skill of allSkills) {
      prompt += `## ${skill.meta.name} (v${skill.meta.version})\n`;
      prompt += `${skill.meta.description}\n`;

      if (skill.meta.triggers.length > 0) {
        prompt += `Triggers: ${skill.meta.triggers.join(', ')}\n`;
      }

      prompt += `---\n${skill.content.slice(0, 1000)}\n`;
      if (skill.content.length > 1000) {
        prompt += '...(truncated)\n';
      }
      prompt += '\n';
    }

    return prompt;
  }
}
