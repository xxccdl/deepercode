import type { Skill, SkillMeta } from './types.js';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    if (this.skills.has(skill.meta.name)) {
      throw new Error(`Skill already registered: ${skill.meta.name}`);
    }
    this.skills.set(skill.meta.name, skill);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  findByTrigger(trigger: string): Skill[] {
    const lowerTrigger = trigger.toLowerCase();
    const matches: Skill[] = [];

    for (const skill of this.skills.values()) {
      if (skill.meta.triggers.some((t) => lowerTrigger.includes(t.toLowerCase()))) {
        matches.push(skill);
      }
    }

    return matches;
  }

  findByTool(toolName: string): Skill[] {
    const matches: Skill[] = [];

    for (const skill of this.skills.values()) {
      if (skill.meta.tools.includes(toolName)) {
        matches.push(skill);
      }
    }

    return matches;
  }

  findByDependency(depName: string): Skill[] {
    const matches: Skill[] = [];

    for (const skill of this.skills.values()) {
      if (skill.meta.dependencies.includes(depName)) {
        matches.push(skill);
      }
    }

    return matches;
  }

  getMeta(): SkillMeta[] {
    return Array.from(this.skills.values()).map((s) => s.meta);
  }

  clear(): void {
    this.skills.clear();
  }

  get size(): number {
    return this.skills.size;
  }
}
