export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  author: string;
  triggers: string[];
  tools: string[];
  dependencies: string[];
}

export interface Skill {
  meta: SkillMeta;
  content: string;
  code?: string;
}

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface SkillLoadResult {
  skill: Skill;
  source: string;
  fromCodeFile: boolean;
}
