import { useEffect, useRef, useState } from "react";
import type { SourceContext, SourceReference, SourceSelection } from "../sources/model";
import { sourceReferenceKey } from "../sources/model";
import { useSourceCatalog } from "../sources/useSourceCatalog";
import { SourceGroupChoices } from "./SourceGroupChoices";
import type { SourceRegistry } from "../sources/registry";

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
  const [query, setQuery] = useState("");
  const { state, retry } = useSourceCatalog(context, selections, registry);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => { element.close(); if (opener?.isConnected) opener.focus(); };
  }, []);

  useEffect(() => setDraft(null), [context, selections, registry]);

  const groups = state.status === "success" ? state.results.flatMap((result) => result.status === "success"
    ? result.groups.map((group) => ({ ...group, providerId: result.providerId })) : []) : [];
  const options = groups.flatMap((group) => group.options.map((option) => ({ option, groupLabel: group.label })));
  const selected = options.find(({ option }) => sourceReferenceKey(option.reference) === draft);

  const term = query.trim().toLocaleLowerCase();
  const matches = groups.some((group) => group.options.length > 0 && (group.label.toLocaleLowerCase().includes(term)
    || group.options.some((option) => option.label.toLocaleLowerCase().includes(term))));
  const failures = state.status === "success" ? state.results.filter((result) => result.status === "error") : [];

  return <dialog ref={dialog} className="source-dialog" aria-labelledby="source-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = [...dialog.current!.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")].filter((element) => !element.closest("[hidden]"));
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <h2 id="source-dialog-title">Select data for {context.targetForm.name} · {context.targetField.label}</h2>
    {state.status === "loading" && <p role="status">Loading sources…</p>}
    <label className="source-search">Search sources
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups or fields" />
    </label>
    {state.status === "error" && <p role="alert">{state.message}</p>}
    {failures.length > 0 && <div role="alert">
      <p>Some sources could not be loaded. Available sources can still be selected.</p>
      <ul>{failures.map((failure) => <li key={failure.providerId}>{failure.providerId}: {failure.message}</li>)}</ul>
    </div>}
    {(state.status === "error" || failures.length > 0) && <button type="button" onClick={() => { setDraft(null); retry(); }}>Retry sources</button>}
    {state.status === "success" && options.length === 0 && <p>No sources available for this field.</p>}
    {state.status === "success" && options.length > 0 && !matches && <p role="status">No sources match your search.</p>}
    <div className="source-groups">
      {groups.map((group) => <SourceGroupChoices key={JSON.stringify([group.providerId, group.id])}
        group={group} query={query} draft={draft} onChoose={setDraft} />)}
    </div>
    <p aria-live="polite">{selected ? `Selected: ${selected.groupLabel} · ${selected.option.label}` : "Choose a source, then select to confirm."}</p>
    <div className="dialog-actions">
      <button type="button" ref={cancel} className="secondary" onClick={onClose}>Cancel</button>
      <button type="button" disabled={!selected} onClick={() => { if (selected) onConfirm(selected.option.reference, `${selected.groupLabel} · ${selected.option.label}`); }}>Select</button>
    </div>
  </dialog>;
}
