import { readEndpoint } from "./config";
import { useBlueprint } from "./useBlueprint";

export function BlueprintConnection() {
  const configuration = readEndpoint(import.meta.env);
  const { state, retry } = useBlueprint(configuration.ok ? configuration.endpoint : null);

  if (!configuration.ok) {
    return <p role="alert">{configuration.message}</p>;
  }
  if (state.status === "error") {
    return (
      <div>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={retry}>Try again</button>
      </div>
    );
  }
  if (state.status === "success") {
    return (
      <div role="status">
        <p>Blueprint response received.</p>
        <p>Form browsing and prefill editing are not available yet.</p>
      </div>
    );
  }
  return <p role="status">Loading blueprint…</p>;
}
