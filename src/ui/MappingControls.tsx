import { useMemo } from "react";
import type { SourceContext, SourceReference, SourceSelection } from "../sources/model";
import { sourceReferenceKey } from "../sources/model";
import type { SourceRegistry } from "../sources/registry";
import { useSourceCatalog } from "../sources/useSourceCatalog";

const emptySelections: readonly SourceSelection[] = [];

export function MappingControls({
  context,
  selections,
  registry,
  mapping,
  fallbackLabel,
  onOpen,
  onClear,
  editingDisabled = false,
}: {
  editingDisabled?: boolean;
  context: SourceContext;
  selections: readonly SourceSelection[] | undefined;
  registry: SourceRegistry;
  mapping: SourceReference | undefined;
  fallbackLabel: string | undefined;
  onOpen: () => void;
  onClear: () => void;
}) {
  const selectedProviders = useMemo(
    () =>
      mapping && selections
        ? selections.filter((selection) => selection.id === mapping.providerId)
        : emptySelections,
    [mapping, selections],
  );
  const enabled = selectedProviders.length > 0;
  const { state, retry } = useSourceCatalog(
    mapping && enabled ? context : null,
    selectedProviders,
    registry,
  );
  const options =
    state.status === "success"
      ? state.results.flatMap((result) =>
          result.status === "success"
            ? result.groups.flatMap((group) =>
                group.options.map((option) => ({
                  ...option,
                  label: `${group.label} · ${option.label}`,
                })),
              )
            : [],
        )
      : [];
  const option =
    mapping &&
    options.find(
      (candidate) => sourceReferenceKey(candidate.reference) === sourceReferenceKey(mapping),
    );
  const failed =
    state.status === "error" ||
    (state.status === "success" && state.results.some((result) => result.status === "error"));
  const unavailable =
    mapping &&
    (selections === undefined
      ? "Source availability unknown: configuration is unavailable."
      : !enabled
        ? "Source unavailable: provider is disabled."
        : failed
          ? "Source unavailable: provider could not be loaded."
          : state.status === "success" && !option
            ? "Source unavailable: this field is no longer offered."
            : null);
  return (
    <div className="mapping-controls">
      <button
        type="button"
        disabled={editingDisabled || selections === undefined}
        aria-label={`${mapping ? "Replace" : "Set"} prefill for ${context.targetField.label}`}
        onClick={onOpen}
      >
        {mapping
          ? (option?.label ??
            fallbackLabel ??
            `${mapping.resourceId} · ${mapping.fieldPath.join(" → ")}`)
          : "Choose prefill source"}
      </button>
      {mapping && (
        <button
          type="button"
          className="secondary"
          disabled={editingDisabled}
          aria-label={`Clear prefill for ${context.targetField.label}`}
          onClick={(event) => {
            const trigger = event.currentTarget.previousElementSibling;
            onClear();
            if (trigger instanceof HTMLButtonElement && !trigger.disabled) trigger.focus();
            else event.currentTarget.closest<HTMLElement>(".form-detail")?.focus();
          }}
        >
          Clear
        </button>
      )}
      {mapping && state.status === "loading" && (
        <span role="status">Checking source availability…</span>
      )}
      {unavailable && (
        <span className="mapping-availability" role="status">
          {unavailable} The mapping is preserved.
        </span>
      )}
      {mapping && failed && (
        <button
          type="button"
          onClick={retry}
          aria-label={`Retry source for ${context.targetField.label}`}
        >
          Retry source
        </button>
      )}
    </div>
  );
}
