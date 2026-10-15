import { useMemo, type MouseEvent } from "react";
import type { SourceContext, SourceReference, SourceSelection } from "../sources/model";
import { getMappingAvailability } from "../mappings/availability";
import type { SourceRegistry } from "../sources/registry";
import { useSourceCatalog } from "../sources/useSourceCatalog";

const emptySelections: readonly SourceSelection[] = [];

interface MappingControlsProps {
  editingDisabled?: boolean;
  context: SourceContext;
  selections: readonly SourceSelection[] | undefined;
  registry: SourceRegistry;
  mapping: SourceReference | undefined;
  fallbackLabel: string | undefined;
  onOpen: () => void;
  onClear: () => void;
}

export function MappingControls({
  context,
  selections,
  registry,
  mapping,
  fallbackLabel,
  onOpen,
  onClear,
  editingDisabled = false,
}: MappingControlsProps) {
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
  const availability = getMappingAvailability(mapping, selections, state);
  const canRetry = availability.status === "unavailable" && availability.reason === "failed";

  function clearAndRestoreFocus(event: MouseEvent<HTMLButtonElement>) {
    const trigger = event.currentTarget.previousElementSibling;
    onClear();
    if (trigger instanceof HTMLButtonElement && !trigger.disabled) {
      trigger.focus();
    } else {
      event.currentTarget.closest<HTMLElement>(".form-detail")?.focus();
    }
  }

  const buttonLabel = mapping
    ? ((availability.status === "available" ? availability.label : undefined) ??
      fallbackLabel ??
      `${mapping.resourceId} · ${mapping.fieldPath.join(" → ")}`)
    : "Choose prefill source";
  return (
    <div className="mapping-controls">
      <button
        type="button"
        disabled={editingDisabled || selections === undefined}
        aria-label={`${mapping ? "Replace" : "Set"} prefill for ${context.targetField.label}`}
        onClick={onOpen}
      >
        {buttonLabel}
      </button>
      {mapping && (
        <button
          type="button"
          className="secondary"
          disabled={editingDisabled}
          aria-label={`Clear prefill for ${context.targetField.label}`}
          onClick={clearAndRestoreFocus}
        >
          Clear
        </button>
      )}
      {availability.status === "checking" && (
        <span role="status">Checking source availability…</span>
      )}
      {availability.status === "unavailable" && (
        <span className="mapping-availability" role="status">
          {availability.message} The mapping is preserved.
        </span>
      )}
      {canRetry && (
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
