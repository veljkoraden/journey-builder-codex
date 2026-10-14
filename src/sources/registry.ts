import type { SourceProvider, SourceSelection } from "./model";
import { directForms, indirectForms } from "./providers/formSources";
import { globalProperties } from "./providers/globalProperties";

export function createSourceRegistry(providers: readonly SourceProvider[]) {
  const registry = new Map<string, SourceProvider>();
  for (const provider of providers) {
    if (!provider.id.trim() || registry.has(provider.id)) {
      throw new Error("Source provider IDs must be nonempty and unique.");
    }
    registry.set(provider.id, provider);
  }
  return {
    resolve(selections: readonly SourceSelection[]) {
      const seen = new Set<string>();
      return selections.map(({ id, settings }) => {
        const provider = registry.get(id);
        if (!provider) throw new Error(`Unknown source provider: ${id}`);
        if (seen.has(id)) throw new Error(`Duplicate source provider: ${id}`);
        seen.add(id);
        return { provider, settings };
      });
    },
  };
}
export type SourceRegistry = ReturnType<typeof createSourceRegistry>;
export const sourceRegistry = createSourceRegistry([directForms, indirectForms, globalProperties]);
