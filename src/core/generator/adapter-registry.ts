import type { AgentAdapter } from "#src/types/agent.js";

const adapters = new Map<string, AgentAdapter>();

/**
 * Register an agent adapter so it becomes available to the generation pipeline.
 *
 * Calling this with the same `adapter.id` twice overwrites the previous entry.
 *
 * @param adapter - The adapter implementation to register.
 */
export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.id, adapter);
}

/**
 * Retrieve a registered adapter by its ID.
 *
 * @param id - The adapter identifier (e.g. `"claude-code"`, `"cursor"`).
 * @returns The matching adapter, or `undefined` if no adapter is registered for that ID.
 */
export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.get(id);
}

/**
 * Return all currently registered adapters as an array.
 *
 * @returns Snapshot array of every registered adapter. Order is insertion order.
 */
export function getAllAdapters(): AgentAdapter[] {
  return [...adapters.values()];
}

/**
 * Run detection across every registered adapter and return those whose
 * presence is confirmed in `projectRoot`.
 *
 * @param projectRoot - Absolute path to the project root to probe.
 * @returns Adapters whose {@link AgentAdapter.detect} method returned `true`.
 */
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

/**
 * Remove all registered adapters from the registry.
 *
 * Primarily used in tests to reset global state between test cases.
 */
export function clearAdapters(): void {
  adapters.clear();
}
