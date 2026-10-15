import { useEffect, useState } from "react";
import { loadSourceCatalog } from "./loadSourceCatalog";
import type { CatalogState, SourceContext, SourceSelection } from "./model";
import type { SourceRegistry } from "./registry";

// Input identity and attempt belong to the result, so stale options disappear before effects run.
export function useSourceCatalog(
  context: SourceContext | null,
  selections: readonly SourceSelection[],
  registry: SourceRegistry,
) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    context: SourceContext;
    selections: readonly SourceSelection[];
    registry: SourceRegistry;
    attempt: number;
    state: CatalogState;
  }>();
  useEffect(() => {
    if (!context) return;
    const controller = new AbortController();
    void loadSourceCatalog(registry, selections, context, controller.signal).then(
      (results) => {
        if (!controller.signal.aborted)
          setLoaded({
            context,
            selections,
            registry,
            attempt,
            state: { status: "success", results },
          });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({
            context,
            selections,
            registry,
            attempt,
            state: {
              status: "error",
              message: error instanceof Error ? error.message : "Unable to load sources.",
            },
          });
      },
    );
    return () => controller.abort();
  }, [context, selections, registry, attempt]);
  const state: CatalogState =
    context === null
      ? { status: "idle" }
      : loaded?.context === context &&
          loaded.selections === selections &&
          loaded.registry === registry &&
          loaded.attempt === attempt
        ? loaded.state
        : { status: "loading" };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
