import { summarizeMappings } from "../mappings/summarizeMappings";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Blueprint, FormField, FormInstance } from "../blueprint/model";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";
import type { SourceReference, SourceSelection } from "../sources/model";
import { sourceRegistry } from "../sources/registry";
import type { SourceRegistry } from "../sources/registry";
import { usePrefillMappings } from "../mappings/usePrefillMappings";
import { FormBrowser } from "./FormBrowser";
import { PrefillForm } from "./PrefillForm";
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
  const currentTarget =
    activeTarget?.blueprint === blueprint &&
    activeTarget.selections === selections &&
    !disabledForms.has(formKey(activeTarget.form.nodeId))
      ? activeTarget
      : null;
  const dialogContext = useMemo(
    () =>
      currentTarget
        ? {
            blueprint,
            dependencies,
            targetForm: currentTarget.form,
            targetField: currentTarget.field,
          }
        : null,
    [blueprint, dependencies, currentTarget],
  );
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
    // The dialog only confirms references still present in its successful catalog.
    setMapping(
      {
        blueprintId: blueprint.id,
        nodeId: currentTarget.form.nodeId,
        fieldKey: currentTarget.field.key,
      },
      source,
      label,
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
          <PrefillForm
            blueprint={blueprint}
            dependencies={dependencies}
            form={form}
            count={counts.get(form.nodeId)!}
            mappingState={state}
            selections={selections}
            registry={registry}
            editingEnabled={!disabledForms.has(formKey(form.nodeId))}
            onEditingChange={(enabled) => setFormEditing(form.nodeId, enabled)}
            onOpen={(field) => openField(form, field)}
            onClear={clearMapping}
          />
        )}
      />
      {currentTarget && dialogContext && (
        <SourceDialog
          context={dialogContext}
          selections={currentTarget.selections}
          registry={registry}
          onClose={closeDialog}
          onConfirm={confirmSource}
        />
      )}
    </>
  );
}
