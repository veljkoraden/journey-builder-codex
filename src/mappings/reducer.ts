import { sourceReferenceKey } from "../sources/model";
import type { SourceReference } from "../sources/model";
import { mappingTargetKey } from "./model";
import type { MappingAction, MappingState, MappingTarget } from "./model";

export function createMappingState(): MappingState {
  return Object.freeze({});
}

export function getMapping(state: MappingState, target: MappingTarget): SourceReference | undefined {
  return state[mappingTargetKey(target)];
}

export function mappingReducer(state: MappingState, action: MappingAction): MappingState {
  const key = mappingTargetKey(action.target);
  if (action.type === "clear") {
    if (!Object.hasOwn(state, key)) return state;
    const next = { ...state };
    delete next[key];
    return Object.freeze(next);
  }

  const previous = state[key];
  if (previous && sourceReferenceKey(previous) === sourceReferenceKey(action.source)) return state;
  // Copy provider-owned data so subsequent mutation cannot rewrite a saved mapping.
  const source: SourceReference = Object.freeze({
    providerId: action.source.providerId,
    resourceId: action.source.resourceId,
    fieldPath: Object.freeze([...action.source.fieldPath]),
  });
  // Setting an existing target replaces its reference atomically.
  return Object.freeze({ ...state, [key]: source });
}
