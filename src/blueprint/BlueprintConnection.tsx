import { PrefillEditor } from "../ui/PrefillEditor";
import type { SourceSelection } from "../sources/model";
import { readEndpoint } from "./config";
import { useBlueprint } from "./useBlueprint";

export function BlueprintConnection({ selections }: { selections: readonly SourceSelection[] | undefined }) {
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
    return <PrefillEditor key={state.data.id} blueprint={state.data} dependencies={state.dependencies} selections={selections} />;
  }
  return <p role="status">Loading blueprint…</p>;
}
