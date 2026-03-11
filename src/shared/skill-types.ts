export type SkillScope = 'user' | 'system';

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  path: string;
  origin: string;
  scope: SkillScope;
}

export interface SkillRoot {
  key: string;
  label: string;
  path: string;
  writable: boolean;
  createTarget: boolean;
}

export interface SkillsOverview {
  codexHome: string;
  claudeHome: string;
  roots: SkillRoot[];
  own: SkillSummary[];
  system: SkillSummary[];
}

export interface SkillDocument extends SkillSummary {
  content: string;
}
