import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "stripe",
  description: "Stripe payments API integration",
  command: "npx",
  args: ["-y", "@stripe/mcp"],
  env: { STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY}" },
};
