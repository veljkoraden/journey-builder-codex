import { summarizeMappings } from "../mappings/summarizeMappings";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Blueprint, FormField, FormInstance } from "../blueprint/model";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";
import { sourceReferenceKey } from "../sources/model";
import type { SourceReference, SourceSelection } from "../sources/model";
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

interface PrefillEditorProps {
  blueprint: Blueprint;
  dependencies: DependencyGraph;
  selections: readonly SourceSelection[] | undefined;
  registry?: SourceRegistry;
}

export function PrefillEditor({
  blueprint,
  dependencies,
  selections,
  registry = sourceRegistry,
}: PrefillEditorProps) {
  const { state, setMapping, clearMapping } = usePrefillMappings();
  const [disabledForms, setDisabledForms] = useState<ReadonlySet<string>>(new Set());
  const counts = useMemo(() => summarizeMappings(blueprint, state), [blueprint, state]);
  const formKey = (nodeId: string) => JSON.stringify([blueprint.id, nodeId]);
  const [sourceLabels, setSourceLabels] = useState<Readonly<Record<string, string>>>({});
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const closeDialog = useCallback(() => setActiveTarget(null), []);
  // A replaced graph/configuration must not keep an old target or draft alive.
  useEffect(() => {
    if (
      activeTarget &&
      (activeTarget.blueprint !== blueprint || activeTarget.selections !== selections)
    )
      setActiveTarget(null);
  }, [activeTarget, blueprint, selections]);
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
  const currentTarget =
    activeTarget?.blueprint === blueprint &&
    activeTarget.selections === selections &&
    !disabledForms.has(formKey(activeTarget.form.nodeId))
      ? activeTarget
      : null;
  function setFormEditing(nodeId: string, enabled: boolean) {
    closeDialog();
    setDisabledForms((previous) => {
      const next = new Set(previous);
      if (enabled) next.delete(formKey(nodeId));
      else next.add(formKey(nodeId));
      return next;
    });
  }

  function openField(form: FormInstance, field: FormField) {
    if (!selections || disabledForms.has(formKey(form.nodeId))) return;
    setActiveTarget({ blueprint, form, field, selections });
  }

  function confirmSource(source: SourceReference, label: string) {
    if (!currentTarget) return;
    setSourceLabels((previous) => ({ ...previous, [sourceReferenceKey(source)]: label }));
    // The dialog only confirms references still present in its successful catalog.
    setMapping(
      {
        blueprintId: blueprint.id,
        nodeId: currentTarget.form.nodeId,
        fieldKey: currentTarget.field.key,
      },
      source,
    );
    closeDialog();
  }

  return (
    <>
      <FormBrowser
        counts={counts}
        blueprint={blueprint}
        onSelect={closeDialog}
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
                    onChange={(event) => setFormEditing(form.nodeId, event.target.checked)}
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
                (sourceLabels[sourceReferenceKey(mapping)] ??
                  `${mapping.resourceId} · ${mapping.fieldPath.join(" → ")}`);
              return (
                <MappingControls
                  context={contexts.get(form.nodeId)!.get(field.key)!}
                  selections={selections}
                  registry={registry}
                  editingDisabled={disabledForms.has(formKey(form.nodeId))}
                  mapping={mapping}
                  fallbackLabel={label || undefined}
                  onOpen={() => openField(form, field)}
                  onClear={() => clearMapping(target)}
                />
              );
            }}
          />
        )}
      />
      {currentTarget && (
        <SourceDialog
          context={contexts.get(currentTarget.form.nodeId)!.get(currentTarget.field.key)!}
          selections={currentTarget.selections}
          registry={registry}
          onClose={closeDialog}
          onConfirm={confirmSource}
        />
      )}
    </>
  );
}
