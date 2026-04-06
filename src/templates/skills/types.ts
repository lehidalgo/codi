/** Counts passed to skill templates that need dynamic artifact counts. */
export interface TemplateCounts {
  rules: number;
  skills: number;
  agents: number;
  flags: number;
  /** Names of installed brand skills (e.g. ["codi-brand", "rl3-brand", "bbva-brand"]). Codi default is always first. */
  brandSkillNames: string[];
}

/** Describes a skill template that may include static files to copy during scaffolding. */
export interface SkillTemplateDescriptor {
  /** The SKILL.md template content (already resolved to string by the loader). */
  template: string;
  /** Absolute path to directory containing assets/, references/, scripts/ to copy. */
  staticDir?: string;
}
