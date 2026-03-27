/**
 * Builtin MCP server template registry.
 * Each entry maps a server name to its configuration template.
 * Adapters use these to generate agent-specific MCP config files.
 *
 * All packages listed here are published to npm and installable via npx.
 */

export interface McpServerTemplate {
  name: string;
  description: string;
  type?: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// --- Official @modelcontextprotocol servers ---

const OFFICIAL_SERVERS: Record<string, McpServerTemplate> = {
  'github': {
    name: 'github',
    description: 'GitHub repository operations (issues, PRs, repos)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
  },
  'filesystem': {
    name: 'filesystem',
    description: 'Local filesystem read/write operations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  },
  'memory': {
    name: 'memory',
    description: 'Persistent knowledge graph for entity storage',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  'sequential-thinking': {
    name: 'sequential-thinking',
    description: 'Step-by-step reasoning for complex problems',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  'fetch': {
    name: 'fetch',
    description: 'Web content fetching and conversion',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
  'git': {
    name: 'git',
    description: 'Git repository read, search, and history',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
  },
  'postgres': {
    name: 'postgres',
    description: 'PostgreSQL database queries and schema inspection',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: { POSTGRES_CONNECTION_STRING: '${POSTGRES_CONNECTION_STRING}' },
  },
  'slack': {
    name: 'slack',
    description: 'Slack workspace messaging and channels',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' },
  },
  'puppeteer': {
    name: 'puppeteer',
    description: 'Browser automation and web scraping',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
  'google-maps': {
    name: 'google-maps',
    description: 'Google Maps geocoding, directions, and places',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-maps'],
    env: { GOOGLE_MAPS_API_KEY: '${GOOGLE_MAPS_API_KEY}' },
  },
  'brave-search': {
    name: 'brave-search',
    description: 'Web search via Brave Search API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
  },
};

// --- Vendor-maintained servers (by service owners) ---

const VENDOR_SERVERS: Record<string, McpServerTemplate> = {
  'playwright': {
    name: 'playwright',
    description: 'Browser automation via Playwright',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
  },
  'stripe': {
    name: 'stripe',
    description: 'Stripe payments API integration',
    command: 'npx',
    args: ['-y', '@stripe/mcp'],
    env: { STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}' },
  },
  'sentry': {
    name: 'sentry',
    description: 'Sentry error monitoring and debugging',
    command: 'npx',
    args: ['-y', '@sentry/mcp-server@latest'],
    env: { SENTRY_ACCESS_TOKEN: '${SENTRY_ACCESS_TOKEN}' },
  },
  'supabase': {
    name: 'supabase',
    description: 'Supabase database and project management',
    command: 'npx',
    args: ['-y', '@supabase/mcp-server-supabase@latest'],
    env: { SUPABASE_ACCESS_TOKEN: '${SUPABASE_ACCESS_TOKEN}' },
  },
  'cloudflare': {
    name: 'cloudflare',
    description: 'Cloudflare Workers, KV, R2, and D1',
    command: 'npx',
    args: ['-y', '@cloudflare/mcp-server-cloudflare'],
    env: { CF_API_TOKEN: '${CF_API_TOKEN}' },
  },
  'notion': {
    name: 'notion',
    description: 'Notion workspace pages and databases',
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: { OPENAPI_MCP_HEADERS: '${OPENAPI_MCP_HEADERS}' },
  },
  'neon': {
    name: 'neon',
    description: 'Neon serverless Postgres management',
    command: 'npx',
    args: ['-y', '@neondatabase/mcp-server-neon'],
    env: { NEON_API_KEY: '${NEON_API_KEY}' },
  },
  'upstash': {
    name: 'upstash',
    description: 'Upstash Redis, QStash, and Vector',
    command: 'npx',
    args: ['-y', '@upstash/mcp-server@latest'],
    env: { UPSTASH_EMAIL: '${UPSTASH_EMAIL}', UPSTASH_API_KEY: '${UPSTASH_API_KEY}' },
  },
  'context7': {
    name: 'context7',
    description: 'Up-to-date library docs for LLMs',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
  },
};

// --- Popular community servers ---

const COMMUNITY_SERVERS: Record<string, McpServerTemplate> = {
  'firecrawl': {
    name: 'firecrawl',
    description: 'Web scraping, crawling, and extraction',
    command: 'npx',
    args: ['-y', 'firecrawl-mcp'],
    env: { FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}' },
  },
  'exa': {
    name: 'exa',
    description: 'AI-native web search via Exa',
    command: 'npx',
    args: ['-y', 'exa-mcp-server'],
    env: { EXA_API_KEY: '${EXA_API_KEY}' },
  },
  'vercel': {
    name: 'vercel',
    description: 'Vercel projects and deployments',
    command: 'npx',
    args: ['-y', 'vercel-mcp'],
    env: { VERCEL_API_KEY: '${VERCEL_API_KEY}' },
  },
  'linear': {
    name: 'linear',
    description: 'Linear issue tracking and project management',
    command: 'npx',
    args: ['-y', 'linear-mcp'],
    env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' },
  },
  'figma': {
    name: 'figma',
    description: 'Figma design file access for developers',
    command: 'npx',
    args: ['-y', 'figma-developer-mcp'],
    env: { FIGMA_API_KEY: '${FIGMA_API_KEY}' },
  },
  'kubernetes': {
    name: 'kubernetes',
    description: 'Kubernetes cluster management',
    command: 'npx',
    args: ['-y', 'mcp-server-kubernetes'],
  },
  'sqlite': {
    name: 'sqlite',
    description: 'SQLite database operations',
    command: 'npx',
    args: ['-y', '@pollinations/mcp-server-sqlite'],
  },
};

export const BUILTIN_MCP_SERVERS: Record<string, McpServerTemplate> = {
  ...OFFICIAL_SERVERS,
  ...VENDOR_SERVERS,
  ...COMMUNITY_SERVERS,
};

export const AVAILABLE_MCP_SERVER_TEMPLATES = Object.keys(BUILTIN_MCP_SERVERS);
