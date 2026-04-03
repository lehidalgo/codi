import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "google-maps",
  description: "Google Maps geocoding, directions, and places",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-google-maps"],
  env: { GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}" },
};
