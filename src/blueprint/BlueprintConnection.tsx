import { FormBrowser } from "../ui/FormBrowser";
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
    return <FormBrowser key={state.data.id} blueprint={state.data} />;
  }
  return <p role="status">Loading blueprint…</p>;
}
