/**
 * MCP server template registry.
 *
 * Each server is defined in its own file under official/, vendor/, or community/.
 * This barrel assembles them into the named exports consumed by the rest of codi.
 *
 * To add a new server:
 *   1. Create a file in the appropriate subdirectory.
 *   2. Export a `server` const of type McpServerEntry.
 *   3. Import it here and add it to the correct group record.
 */

export type { McpServerTemplate, McpServerEntry } from "./types.js";
import { withDefaultVersions } from "./types.js";
import type { McpServerTemplate } from "./types.js";

// --- Official @modelcontextprotocol servers ---
import { server as github } from "./official/github.js";
import { server as filesystem } from "./official/filesystem.js";
import { server as memory } from "./official/memory.js";
import { server as sequentialThinking } from "./official/sequential-thinking.js";
import { server as fetch } from "./official/fetch.js";
import { server as git } from "./official/git.js";
import { server as postgres } from "./official/postgres.js";
import { server as slack } from "./official/slack.js";
import { server as puppeteer } from "./official/puppeteer.js";
import { server as googleMaps } from "./official/google-maps.js";
import { server as braveSearch } from "./official/brave-search.js";

// --- Vendor-maintained servers (by service owners) ---
import { server as playwright } from "./vendor/playwright.js";
import { server as stripe } from "./vendor/stripe.js";
import { server as sentry } from "./vendor/sentry.js";
import { server as supabase } from "./vendor/supabase.js";
import { server as cloudflare } from "./vendor/cloudflare.js";
import { server as notion } from "./vendor/notion.js";
import { server as neon } from "./vendor/neon.js";
import { server as neonCloud } from "./vendor/neon-cloud.js";
import { server as upstash } from "./vendor/upstash.js";
import { server as context7 } from "./vendor/context7.js";
import { server as openaiDeveloperDocs } from "./vendor/openai-developer-docs.js";
import { server as anthropicDocs } from "./vendor/anthropic-docs.js";

// --- Popular community servers ---
import { server as firecrawl } from "./community/firecrawl.js";
import { server as exa } from "./community/exa.js";
import { server as vercel } from "./community/vercel.js";
import { server as linear } from "./community/linear.js";
import { server as figma } from "./community/figma.js";
import { server as kubernetes } from "./community/kubernetes.js";
import { server as sqlite } from "./community/sqlite.js";
import { server as graphCode } from "./community/graph-code.js";
import { server as chromeDevtools } from "./community/chrome-devtools.js";

const OFFICIAL_SERVERS = withDefaultVersions({
  github,
  filesystem,
  memory,
  "sequential-thinking": sequentialThinking,
  fetch,
  git,
  postgres,
  slack,
  puppeteer,
  "google-maps": googleMaps,
  "brave-search": braveSearch,
});

const VENDOR_SERVERS = withDefaultVersions({
  playwright,
  stripe,
  sentry,
  supabase,
  cloudflare,
  notion,
  neon,
  "neon-cloud": neonCloud,
  upstash,
  context7,
  "openai-developer-docs": openaiDeveloperDocs,
  "anthropic-docs": anthropicDocs,
});

const COMMUNITY_SERVERS = withDefaultVersions({
  firecrawl,
  exa,
  vercel,
  linear,
  figma,
  kubernetes,
  sqlite,
  "graph-code": graphCode,
  "chrome-devtools": chromeDevtools,
});

export const BUILTIN_MCP_SERVERS: Record<string, McpServerTemplate> = {
  ...OFFICIAL_SERVERS,
  ...VENDOR_SERVERS,
  ...COMMUNITY_SERVERS,
};

export const AVAILABLE_MCP_SERVER_TEMPLATES = Object.keys(BUILTIN_MCP_SERVERS);

export const MCP_SERVER_GROUPS: Record<string, string[]> = {
  "Official (MCP)": Object.keys(OFFICIAL_SERVERS),
  "Vendor-Maintained": Object.keys(VENDOR_SERVERS),
  Community: Object.keys(COMMUNITY_SERVERS),
};
