import { useCallback, useEffect, useState } from "react";
import type { Blueprint, FormField, FormInstance } from "../blueprint/model";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";
import { sourceReferenceKey } from "../sources/model";
import type { SourceSelection } from "../sources/model";
import { sourceRegistry } from "../sources/registry";
import type { SourceRegistry } from "../sources/registry";
import { getMapping } from "../mappings/reducer";
import { usePrefillMappings } from "../mappings/usePrefillMappings";
import { FormBrowser } from "./FormBrowser";
import { FormFields } from "./FormFields";
import { SourceDialog } from "./SourceDialog";

type ActiveTarget = {
  blueprint: Blueprint;
  form: FormInstance;
  field: FormField;
  selections: readonly SourceSelection[];
};

export function PrefillEditor({ blueprint, dependencies, selections, registry = sourceRegistry }: {
  blueprint: Blueprint;
  dependencies: DependencyGraph;
  selections: readonly SourceSelection[] | undefined;
  registry?: SourceRegistry;
}) {
  const { state, setMapping, clearMapping } = usePrefillMappings();
  const [labels, setLabels] = useState<Readonly<Record<string, string>>>({});
  const [active, setActive] = useState<ActiveTarget | null>(null);
  const close = useCallback(() => setActive(null), []);
  // A replaced graph/configuration must not keep an old target or draft alive.
  useEffect(() => {
    if (active && (active.blueprint !== blueprint || active.selections !== selections)) setActive(null);
  }, [active, blueprint, selections]);
  const current = active?.blueprint === blueprint && active.selections === selections ? active : null;
  return <>
    <FormBrowser blueprint={blueprint} onSelect={close} renderFields={(form) => (
      <FormFields form={form} renderControls={(field) => {
        const target = { blueprintId: blueprint.id, nodeId: form.nodeId, fieldKey: field.key };
        const mapping = getMapping(state, target);
        const label = mapping && (labels[sourceReferenceKey(mapping)] ?? `${mapping.resourceId} · ${mapping.fieldPath.join(" → ")}`);
        return <div className="mapping-controls">
          <button type="button" disabled={selections === undefined}
            aria-label={`${mapping ? "Replace" : "Set"} prefill for ${field.label}`}
            onClick={() => { if (selections) setActive({ blueprint, form, field, selections }); }}>
            {mapping ? label : "Choose prefill source"}
          </button>
          {mapping && <button type="button" className="secondary" aria-label={`Clear prefill for ${field.label}`}
            onClick={(event) => {
              const trigger = event.currentTarget.previousElementSibling;
              clearMapping(target);
              if (trigger instanceof HTMLButtonElement && !trigger.disabled) trigger.focus();
            }}>Clear</button>}
        </div>;
      }} />
    )} />
    {current && <SourceDialog context={{ blueprint, dependencies, targetForm: current.form, targetField: current.field }}
      selections={current.selections} registry={registry} onClose={close} onConfirm={(source, label) => {
        setLabels((previous) => ({ ...previous, [sourceReferenceKey(source)]: label }));
        // Dialog confirms only references still present in its current successful catalog.
        setMapping({ blueprintId: blueprint.id, nodeId: current.form.nodeId, fieldKey: current.field.key }, source);
        close();
      }} />}
  </>;
}
