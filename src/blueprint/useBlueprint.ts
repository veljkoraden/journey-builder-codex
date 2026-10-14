import { useEffect, useState } from "react";
import { fetchBlueprint } from "./client";

export type BlueprintState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: unknown }
  | { status: "error"; message: string };

export function useBlueprint(endpoint: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    endpoint: string | null;
    attempt: number;
    state: BlueprintState;
  }>({ endpoint: null, attempt: 0, state: { status: "idle" } });

  useEffect(() => {
    if (endpoint === null) return;
    const controller = new AbortController();
    setResult({ endpoint, attempt, state: { status: "loading" } });
    void fetchBlueprint(endpoint, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult({ endpoint, attempt, state: { status: "success", data } });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            endpoint,
            attempt,
            state: {
              status: "error",
              message: error instanceof Error ? error.message : "Unable to load the blueprint. Try again.",
            },
          });
        }
      },
    );
    return () => controller.abort();
  }, [endpoint, attempt]);

  // Do not expose a previous blueprint while a new effect is being scheduled.
  const state: BlueprintState = endpoint === null
    ? { status: "idle" }
    : result.endpoint === endpoint && result.attempt === attempt
      ? result.state
      : { status: "loading" };

  return { state, retry: () => setAttempt((value) => value + 1) };
}
