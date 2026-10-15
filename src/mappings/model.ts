import type { SourceReference } from "../sources/model";

// A node identifies a form instance; definition IDs and labels are not identities.
export interface MappingTarget {
  readonly blueprintId: string;
  readonly nodeId: string;
  readonly fieldKey: string;
}

export interface SavedMapping {
  readonly source: SourceReference;
  // A target-local snapshot used only when the current catalog cannot supply a label.
  readonly fallbackLabel?: string | undefined;
}

export type MappingState = Readonly<Record<string, SavedMapping>>;
export type MappingAction =
  | {
      readonly type: "set";
      readonly target: MappingTarget;
      readonly source: SourceReference;
      readonly fallbackLabel?: string | undefined;
    }
  | { readonly type: "clear"; readonly target: MappingTarget };

// JSON tuple encoding prevents delimiter, dotted-key, and prototype-key collisions.
export function mappingTargetKey(target: MappingTarget): string {
  return JSON.stringify([target.blueprintId, target.nodeId, target.fieldKey]);
}
