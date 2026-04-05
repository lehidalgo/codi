import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "slack",
  description: "Slack workspace messaging and channels",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-slack"],
  env: {
    SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}",
    SLACK_TEAM_ID: "${SLACK_TEAM_ID}",
  },
};
