import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./docs/src/content/docs" }),
    schema: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        sidebar: z
          .object({
            order: z.number().optional(),
            label: z.string().optional(),
          })
          .optional(),
        // Artifact catalog fields
        artifactType: z.enum(["skill", "rule", "agent", "preset"]).optional(),
        artifactCategory: z.string().optional(),
        userInvocable: z.boolean().optional(),
        compatibility: z.array(z.string()).optional(),
        compatibilityAgents: z.array(z.string()).optional(),
        priority: z.string().optional(),
        alwaysApply: z.boolean().optional(),
        tools: z.array(z.string()).optional(),
        model: z.string().optional(),
        tags: z.array(z.string()).optional(),
        version: z.union([z.number(), z.string()]).optional(),
      })
      .passthrough(),
  }),
};
