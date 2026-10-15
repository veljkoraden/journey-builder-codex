import type { useSourceConfiguration } from "./useSourceConfiguration";

export function SourceConfigurationStatus({
  configuration,
}: {
  configuration: ReturnType<typeof useSourceConfiguration>;
}) {
  const { state, retry } = configuration;
  return (
    <section aria-labelledby="source-configuration-heading">
      <h2 id="source-configuration-heading">Prefill sources</h2>
      {state.status === "loading" && <p role="status">Loading source configuration…</p>}
      {state.status === "error" && (
        <>
          <p role="alert">{state.message}</p>
          <button type="button" onClick={retry}>
            Retry source configuration
          </button>
        </>
      )}
      {state.status === "success" && (
        <>
          <p>
            {state.selections.length === 0
              ? "No prefill sources enabled."
              : `${state.selections.length} prefill source${state.selections.length === 1 ? "" : "s"} enabled.`}
          </p>
          <button type="button" className="secondary" onClick={retry}>
            Refresh source settings
          </button>
        </>
      )}
    </section>
  );
}
