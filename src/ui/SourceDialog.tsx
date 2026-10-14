import { useEffect, useRef, useState } from "react";
import type { ProviderResult, SourceContext, SourceReference, SourceSelection } from "../sources/model";
import { sourceReferenceKey } from "../sources/model";
import { loadSourceCatalog } from "../sources/loadSourceCatalog";
import type { SourceRegistry } from "../sources/registry";

type CatalogState = { status: "loading" } | { status: "error"; message: string }
  | { status: "success"; results: readonly ProviderResult[] };

export function SourceDialog({ context, selections, registry, onClose, onConfirm }: {
  context: SourceContext;
  selections: readonly SourceSelection[];
  registry: SourceRegistry;
  onClose: () => void;
  onConfirm: (source: SourceReference, label: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ context: SourceContext; selections: readonly SourceSelection[]; registry: SourceRegistry; state: CatalogState }>();
  const state: CatalogState = loaded?.context === context && loaded.selections === selections && loaded.registry === registry
    ? loaded.state : { status: "loading" };

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => { element.close(); if (opener?.isConnected) opener.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDraft(null);
    void loadSourceCatalog(registry, selections, context, controller.signal).then(
      (results) => { if (!controller.signal.aborted) setLoaded({ context, selections, registry, state: { status: "success", results } }); },
      (error: unknown) => { if (!controller.signal.aborted) setLoaded({ context, selections, registry, state: {
        status: "error", message: error instanceof Error ? error.message : "Unable to load sources.",
      } }); },
    );
    return () => controller.abort();
  }, [context, selections, registry]);

  const groups = state.status === "success" ? state.results.flatMap((result) => result.status === "success"
    ? result.groups.map((group) => ({ ...group, providerId: result.providerId })) : []) : [];
  const options = groups.flatMap((group) => group.options.map((option) => ({ option, groupLabel: group.label })));
  const selected = options.find(({ option }) => sourceReferenceKey(option.reference) === draft);

  return <dialog ref={dialog} className="source-dialog" aria-labelledby="source-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = [...dialog.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <h2 id="source-dialog-title">Select data for {context.targetForm.name} · {context.targetField.label}</h2>
    {state.status === "loading" && <p role="status">Loading sources…</p>}
    {state.status === "error" && <p role="alert">{state.message}</p>}
    {state.status === "success" && state.results.some((result) => result.status === "error")
      && <p role="alert">Some sources could not be loaded. You can use the available sources or close and try again.</p>}
    {state.status === "success" && options.length === 0 && <p>No sources available for this field.</p>}
    <div className="source-groups">
      {groups.map((group) => <fieldset key={JSON.stringify([group.providerId, group.id])}>
        <legend>{group.label}</legend>
        {group.options.map((option) => {
          const key = sourceReferenceKey(option.reference);
          return <button type="button" key={key} aria-pressed={draft === key} onClick={() => setDraft(key)}>
            {option.label}
          </button>;
        })}
      </fieldset>)}
    </div>
    <p aria-live="polite">{selected ? `Selected: ${selected.groupLabel} · ${selected.option.label}` : "Choose a source, then select to confirm."}</p>
    <div className="dialog-actions">
      <button type="button" ref={cancel} className="secondary" onClick={onClose}>Cancel</button>
      <button type="button" disabled={!selected} onClick={() => { if (selected) onConfirm(selected.option.reference, `${selected.groupLabel} · ${selected.option.label}`); }}>Select</button>
    </div>
  </dialog>;
}
