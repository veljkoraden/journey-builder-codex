import { useMemo, useRef, type RefObject } from "react";
import type { Blueprint, FormField, FormInstance } from "../blueprint/model";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";
import type { MappingState, MappingTarget } from "../mappings/model";
import { getMapping } from "../mappings/reducer";
import type { MappingCount } from "../mappings/summarizeMappings";
import { sourceReferenceKey, type SourceSelection } from "../sources/model";
import type { SourceRegistry } from "../sources/registry";
import { FormFields } from "./FormFields";
import { MappingControls } from "./MappingControls";
import { PrefillSettings } from "./PrefillSettings";

interface PrefillFormProps {
  blueprint: Blueprint;
  dependencies: DependencyGraph;
  form: FormInstance;
  count: MappingCount;
  mappingState: MappingState;
  sourceLabels: Readonly<Record<string, string>>;
  selections: readonly SourceSelection[] | undefined;
  registry: SourceRegistry;
  editingEnabled: boolean;
  onEditingChange: (enabled: boolean) => void;
  onOpen: (field: FormField) => void;
  onClear: (target: MappingTarget) => void;
}

export function PrefillForm(props: PrefillFormProps) {
  const regionRef = useRef<HTMLElement>(null);
  return (
    <FormFields
      form={props.form}
      regionRef={regionRef}
      header={
        <PrefillSettings
          formName={props.form.name}
          count={props.count}
          enabled={props.editingEnabled}
          onChange={props.onEditingChange}
        />
      }
      renderControls={(field) => (
        <PrefillFieldControls {...props} field={field} regionRef={regionRef} />
      )}
    />
  );
}

// Each mounted field owns stable provider inputs; unrelated editor renders do not refetch.
function PrefillFieldControls({
  blueprint,
  dependencies,
  form,
  field,
  mappingState,
  sourceLabels,
  selections,
  registry,
  editingEnabled,
  onOpen,
  onClear,
  regionRef,
}: Omit<PrefillFormProps, "count" | "onEditingChange"> & {
  field: FormField;
  regionRef: RefObject<HTMLElement | null>;
}) {
  const context = useMemo(
    () => ({ blueprint, dependencies, targetForm: form, targetField: field }),
    [blueprint, dependencies, form, field],
  );
  const target = { blueprintId: blueprint.id, nodeId: form.nodeId, fieldKey: field.key };
  const mapping = getMapping(mappingState, target);
  return (
    <MappingControls
      context={context}
      selections={selections}
      registry={registry}
      mapping={mapping}
      fallbackLabel={mapping ? sourceLabels[sourceReferenceKey(mapping)] : undefined}
      editingDisabled={!editingEnabled}
      fallbackFocusRef={regionRef}
      onOpen={() => onOpen(field)}
      onClear={() => onClear(target)}
    />
  );
}
