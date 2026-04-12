import { z } from "zod";

export const SkillTestManifestSchema = z.object({
  skill: z.string().min(1),
  tiers: z.object({
    contract: z.boolean().default(true),
    logic: z
      .object({
        lib: z.string(),
        tests: z.string(),
      })
      .optional(),
    behavior: z
      .object({
        server: z.string(),
        startScript: z.string(),
        tests: z.string(),
        // port is informational only — the server always binds to a random available port
        // via the start script and reports the actual URL in its stdout JSON.
        // Do not use this field to hard-code a port; use the resolved URL from startServer().
        port: z.number().optional(),
      })
      .optional(),
  }),
});

export type SkillTestManifest = z.infer<typeof SkillTestManifestSchema>;
