import { sourceReferenceKey } from "../sources/model";
import type { SourceReference } from "../sources/model";
import { mappingTargetKey } from "./model";
import type { MappingAction, MappingState, MappingTarget, SavedMapping } from "./model";

export function createMappingState(): MappingState {
  return Object.freeze({});
}

export function getMapping(
  state: MappingState,
  target: MappingTarget,
): SourceReference | undefined {
  return getSavedMapping(state, target)?.source;
}

export function getSavedMapping(
  state: MappingState,
  target: MappingTarget,
): SavedMapping | undefined {
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
  const sameSource =
    previous && sourceReferenceKey(previous.source) === sourceReferenceKey(action.source);
  if (sameSource && previous.fallbackLabel === action.fallbackLabel) return state;
  // Preserve source object identity on label-only edits to avoid restarting availability checks.
  const source: SourceReference = sameSource
    ? previous.source
    : Object.freeze({
        providerId: action.source.providerId,
        resourceId: action.source.resourceId,
        fieldPath: Object.freeze([...action.source.fieldPath]),
      });
  const saved: SavedMapping = Object.freeze({ source, fallbackLabel: action.fallbackLabel });
  return Object.freeze({ ...state, [key]: saved });
}
