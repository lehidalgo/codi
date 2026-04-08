import { BRAND_CATEGORY } from "#src/constants.js";
import type { NormalizedSkill } from "#src/types/config.js";

/**
 * Skills split into brand skills and all others.
 * @see {@link partitionBrandSkills}
 */
export interface PartitionedSkills {
  /** Skills whose `category` is not the brand category. */
  regularSkills: NormalizedSkill[];
  /** Skills whose `category` matches {@link BRAND_CATEGORY}. */
  brandSkills: NormalizedSkill[];
}

/**
 * Split a flat list of skills into brand skills and regular skills.
 *
 * Brand skills are rendered in a separate section of the instruction file
 * so adapters can group them visually (e.g. under a "Brand" heading).
 *
 * @param skills - Full list of normalized skills from the resolved config.
 * @returns An object with `regularSkills` and `brandSkills` arrays.
 */
export function partitionBrandSkills(skills: NormalizedSkill[]): PartitionedSkills {
  return {
    regularSkills: skills.filter((s) => s.category !== BRAND_CATEGORY),
    brandSkills: skills.filter((s) => s.category === BRAND_CATEGORY),
  };
}
