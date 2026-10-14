import { useCallback, useReducer } from "react";
import type { SourceReference } from "../sources/model";
import type { MappingTarget } from "./model";
import { createMappingState, mappingReducer } from "./reducer";

// Mount once at the editor owner, above form/field selection, to retain edits.
export function usePrefillMappings() {
  const [state, dispatch] = useReducer(mappingReducer, undefined, createMappingState);
  const setMapping = useCallback((target: MappingTarget, source: SourceReference) => {
    dispatch({ type: "set", target, source });
  }, []);
  const clearMapping = useCallback((target: MappingTarget) => {
    dispatch({ type: "clear", target });
  }, []);
  return { state, setMapping, clearMapping };
}
