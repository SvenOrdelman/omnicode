export type SkillScope = 'user' | 'system';

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  path: string;
  scope: SkillScope;
}

export interface SkillsOverview {
  codexHome: string;
  own: SkillSummary[];
  system: SkillSummary[];
}

export interface SkillDocument extends SkillSummary {
  content: string;
}
