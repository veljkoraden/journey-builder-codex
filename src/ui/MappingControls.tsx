import { useMemo, useRef, type RefObject } from "react";
import type { SourceContext, SourceReference, SourceSelection } from "../sources/model";
import { getMappingAvailability } from "../mappings/availability";
import type { SourceRegistry } from "../sources/registry";
import { useSourceCatalog } from "../sources/useSourceCatalog";

const emptySelections: readonly SourceSelection[] = [];

interface MappingControlsProps {
  editingDisabled?: boolean;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
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
  fallbackFocusRef,
}: MappingControlsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  function clearAndRestoreFocus() {
    const trigger = triggerRef.current;
    onClear();
    if (trigger && !trigger.disabled) {
      trigger.focus();
    } else {
      fallbackFocusRef?.current?.focus();
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
        ref={triggerRef}
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
