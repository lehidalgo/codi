/** Counts passed to skill templates that need dynamic artifact counts. */
export interface TemplateCounts {
  rules: number;
  skills: number;
  agents: number;
  flags: number;
}

/** Describes a skill template that may include static files to copy during scaffolding. */
export interface SkillTemplateDescriptor {
  /** The SKILL.md template content (already resolved to string by the loader). */
  template: string;
  /** Absolute path to directory containing assets/, references/, scripts/ to copy. */
  staticDir?: string;
}
