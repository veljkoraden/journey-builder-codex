import { isPrefillField } from "../blueprint/fieldPolicy";
import type { Blueprint } from "../blueprint/model";
import type { MappingState } from "./model";
import { getMapping } from "./reducer";

export interface MappingCount { readonly mapped: number; readonly total: number }

// Count current editable fields, not stale entries or reusable form definitions.
export function summarizeMappings(blueprint: Blueprint, state: MappingState): ReadonlyMap<string, MappingCount> {
  return new Map(blueprint.forms.map((form) => {
    const fields = form.fields.filter(isPrefillField);
    return [form.nodeId, {
      total: fields.length,
      mapped: fields.filter((field) => getMapping(state, {
        blueprintId: blueprint.id, nodeId: form.nodeId, fieldKey: field.key,
      }) !== undefined).length,
    }];
  }));
}
