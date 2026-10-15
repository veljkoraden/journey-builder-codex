import { useEffect, useState } from "react";
import { loadSourceConfiguration, sourceConfigurationUrl } from "./configuration";
import type { SourceSelection } from "./model";
import { sourceRegistry } from "./registry";

type ConfigurationState =
  | { status: "loading" }
  | { status: "success"; selections: readonly SourceSelection[] }
  | { status: "error"; message: string };

export function useSourceConfiguration(url = sourceConfigurationUrl(import.meta.env.BASE_URL)) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    url: string;
    attempt: number;
    state: ConfigurationState;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void loadSourceConfiguration(controller.signal, sourceRegistry, url).then(
      (selections) => {
        if (!controller.signal.aborted)
          setResult({ url, attempt, state: { status: "success", selections } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            url,
            attempt,
            state: {
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Unable to load source configuration. Retry.",
            },
          });
      },
    );
    return () => controller.abort();
  }, [url, attempt]);
  const state: ConfigurationState =
    result?.url === url && result.attempt === attempt ? result.state : { status: "loading" };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
