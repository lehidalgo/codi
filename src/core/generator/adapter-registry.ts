import type { AgentAdapter } from "#src/types/agent.js";

const adapters = new Map<string, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.get(id);
}

export function getAllAdapters(): AgentAdapter[] {
  return [...adapters.values()];
}

export async function detectAdapters(projectRoot: string): Promise<AgentAdapter[]> {
  const results: AgentAdapter[] = [];
  for (const adapter of adapters.values()) {
    const detected = await adapter.detect(projectRoot);
    if (detected) {
      results.push(adapter);
    }
  }
  return results;
}

export function clearAdapters(): void {
  adapters.clear();
}
