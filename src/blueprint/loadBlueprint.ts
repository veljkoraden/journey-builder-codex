import { createDependencyGraph } from "../dependencies/createDependencyGraph";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";
import { fetchBlueprint } from "./client";
import type { Blueprint } from "./model";
import { normalizeBlueprint } from "./normalizeBlueprint";

export interface LoadedBlueprint {
  readonly data: Blueprint;
  readonly dependencies: DependencyGraph;
}

// Construct the index once per response, before the hook can publish success.
export async function loadBlueprint(
  endpoint: string,
  signal: AbortSignal,
): Promise<LoadedBlueprint> {
  const response = await fetchBlueprint(endpoint, signal);
  signal.throwIfAborted();
  const data = normalizeBlueprint(response);
  const dependencies = createDependencyGraph(data);
  return { data, dependencies };
}
