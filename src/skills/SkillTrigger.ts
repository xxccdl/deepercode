import type { Skill } from './types.js';
import type { SkillRegistry } from './SkillRegistry.js';

interface TriggerMatch {
  skill: Skill;
  score: number;
  matchedTriggers: string[];
}

export class SkillTrigger {
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }

  match(input: string): Skill[] {
    const lowerInput = input.toLowerCase();
    const matches: TriggerMatch[] = [];

    for (const skill of this.registry.getAll()) {
      const matchedTriggers: string[] = [];
      let score = 0;

      for (const trigger of skill.meta.triggers) {
        const lowerTrigger = trigger.toLowerCase();
        if (lowerInput.includes(lowerTrigger)) {
          matchedTriggers.push(trigger);
          score += lowerTrigger.length;
        }
      }

      const nameMatch = skill.meta.name.toLowerCase();
      if (lowerInput.includes(nameMatch)) {
        matchedTriggers.push(skill.meta.name);
        score += nameMatch.length * 2;
      }

      const descWords = skill.meta.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && lowerInput.includes(word)) {
          score += 1;
        }
      }

      if (matchedTriggers.length > 0 || score > 0) {
        matches.push({ skill, score, matchedTriggers });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return matches.map((m) => m.skill);
  }

  getRecommendedSkills(input: string, maxResults: number = 3): Array<{
    skill: Skill;
    reason: string;
  }> {
    const matched = this.match(input).slice(0, maxResults);

    return matched.map((skill) => {
      const reasons: string[] = [];

      const lowerInput = input.toLowerCase();
      for (const trigger of skill.meta.triggers) {
        if (lowerInput.includes(trigger.toLowerCase())) {
          reasons.push(`matched trigger: "${trigger}"`);
        }
      }

      if (lowerInput.includes(skill.meta.name.toLowerCase())) {
        reasons.push(`matched name: "${skill.meta.name}"`);
      }

      return {
        skill,
        reason: reasons.length > 0 ? reasons.join(', ') : 'contextually relevant',
      };
    });
  }
}
