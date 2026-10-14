import type { SourceReference } from "../sources/model";

// A node identifies a form instance; definition IDs and labels are not identities.
export interface MappingTarget {
  readonly blueprintId: string;
  readonly nodeId: string;
  readonly fieldKey: string;
}

export type MappingState = Readonly<Record<string, SourceReference>>;
export type MappingAction =
  | { readonly type: "set"; readonly target: MappingTarget; readonly source: SourceReference }
  | { readonly type: "clear"; readonly target: MappingTarget };

// JSON tuple encoding prevents delimiter, dotted-key, and prototype-key collisions.
export function mappingTargetKey(target: MappingTarget): string {
  return JSON.stringify([target.blueprintId, target.nodeId, target.fieldKey]);
}
