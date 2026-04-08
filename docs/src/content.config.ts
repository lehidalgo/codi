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
      })
      .passthrough(),
  }),
};
