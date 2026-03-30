import { prefixedName, PROJECT_NAME } from "#src/constants.js";
import { preset as minimal } from "./minimal.js";
import { preset as balanced } from "./balanced.js";
import { preset as strict } from "./strict.js";
import { preset as fullstack } from "./fullstack.js";
import { preset as development } from "./development.js";
import { preset as powerUser } from "./power-user.js";
import type { BuiltinPresetDefinition } from "./types.js";

export { minimal, balanced, strict, fullstack, development, powerUser };

export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
  [prefixedName("minimal")]: minimal,
  [prefixedName("balanced")]: balanced,
  [prefixedName("strict")]: strict,
  [prefixedName("fullstack")]: fullstack,
  [`${PROJECT_NAME}-dev`]: development,
  [prefixedName("power-user")]: powerUser,
};

export function getBuiltinPresetDefinition(
  name: string,
): BuiltinPresetDefinition | undefined {
  return BUILTIN_PRESETS[name];
}

export function getBuiltinPresetNames(): string[] {
  return Object.keys(BUILTIN_PRESETS);
}

export type { BuiltinPresetDefinition } from "./types.js";
