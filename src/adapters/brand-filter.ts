import { BRAND_CATEGORY } from "#src/constants.js";
import type { NormalizedSkill } from "#src/types/config.js";

export interface PartitionedSkills {
  regularSkills: NormalizedSkill[];
  brandSkills: NormalizedSkill[];
}

export function partitionBrandSkills(
  skills: NormalizedSkill[],
): PartitionedSkills {
  return {
    regularSkills: skills.filter((s) => s.category !== BRAND_CATEGORY),
    brandSkills: skills.filter((s) => s.category === BRAND_CATEGORY),
  };
}
