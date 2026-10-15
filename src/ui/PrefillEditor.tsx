import { summarizeMappings } from "../mappings/summarizeMappings";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MappingControls } from "./MappingControls";
import { SourceDialog } from "./SourceDialog";

type ActiveTarget = {
  blueprint: Blueprint;
  form: FormInstance;
  field: FormField;
  selections: readonly SourceSelection[];
};

export function PrefillEditor({
  blueprint,
  dependencies,
  selections,
  registry = sourceRegistry,
}: {
  blueprint: Blueprint;
  dependencies: DependencyGraph;
  selections: readonly SourceSelection[] | undefined;
  registry?: SourceRegistry;
}) {
  const { state, setMapping, clearMapping } = usePrefillMappings();
  const [disabledForms, setDisabledForms] = useState<ReadonlySet<string>>(new Set());
  const counts = useMemo(() => summarizeMappings(blueprint, state), [blueprint, state]);
  const formKey = (nodeId: string) => JSON.stringify([blueprint.id, nodeId]);
  const [labels, setLabels] = useState<Readonly<Record<string, string>>>({});
  const [active, setActive] = useState<ActiveTarget | null>(null);
  const close = useCallback(() => setActive(null), []);
  // A replaced graph/configuration must not keep an old target or draft alive.
  useEffect(() => {
    if (active && (active.blueprint !== blueprint || active.selections !== selections))
      setActive(null);
  }, [active, blueprint, selections]);
  const contexts = useMemo(
    () =>
      new Map(
        blueprint.forms.map((form) => [
          form.nodeId,
          new Map(
            form.fields.map((field) => [
              field.key,
              { blueprint, dependencies, targetForm: form, targetField: field },
            ]),
          ),
        ]),
      ),
    [blueprint, dependencies],
  );
  const current =
    active?.blueprint === blueprint &&
    active.selections === selections &&
    !disabledForms.has(formKey(active.form.nodeId))
      ? active
      : null;
  return (
    <>
      <FormBrowser
        counts={counts}
        blueprint={blueprint}
        onSelect={close}
        renderFields={(form) => (
          <FormFields
            form={form}
            header={
              <div className="prefill-settings">
                <span className="mapping-count">
                  {counts.get(form.nodeId)!.mapped} of {counts.get(form.nodeId)!.total} fields
                  mapped
                </span>
                <label className="prefill-toggle">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Enable prefill for ${form.name}`}
                    checked={!disabledForms.has(formKey(form.nodeId))}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      close();
                      setDisabledForms((previous) => {
                        const next = new Set(previous);
                        if (enabled) next.delete(formKey(form.nodeId));
                        else next.add(formKey(form.nodeId));
                        return next;
                      });
                    }}
                  />
                  Prefill {disabledForms.has(formKey(form.nodeId)) ? "off" : "on"}
                </label>
                {disabledForms.has(formKey(form.nodeId)) && (
                  <p className="prefill-paused">Editing is off. Existing mappings are preserved.</p>
                )}
              </div>
            }
            renderControls={(field) => {
              const target = {
                blueprintId: blueprint.id,
                nodeId: form.nodeId,
                fieldKey: field.key,
              };
              const mapping = getMapping(state, target);
              const label =
                mapping &&
                (labels[sourceReferenceKey(mapping)] ??
                  `${mapping.resourceId} · ${mapping.fieldPath.join(" → ")}`);
              return (
                <MappingControls
                  context={contexts.get(form.nodeId)!.get(field.key)!}
                  selections={selections}
                  registry={registry}
                  editingDisabled={disabledForms.has(formKey(form.nodeId))}
                  mapping={mapping}
                  fallbackLabel={label || undefined}
                  onOpen={() => {
                    if (selections && !disabledForms.has(formKey(form.nodeId)))
                      setActive({ blueprint, form, field, selections });
                  }}
                  onClear={() => clearMapping(target)}
                />
              );
            }}
          />
        )}
      />
      {current && (
        <SourceDialog
          context={contexts.get(current.form.nodeId)!.get(current.field.key)!}
          selections={current.selections}
          registry={registry}
          onClose={close}
          onConfirm={(source, label) => {
            setLabels((previous) => ({ ...previous, [sourceReferenceKey(source)]: label }));
            // Dialog confirms only references still present in its current successful catalog.
            setMapping(
              {
                blueprintId: blueprint.id,
                nodeId: current.form.nodeId,
                fieldKey: current.field.key,
              },
              source,
            );
            close();
          }}
        />
      )}
    </>
  );
}
