import type { Blueprint, FormField, FormInstance } from "../blueprint/model";
import type { DependencyGraph } from "../dependencies/createDependencyGraph";

export interface SourceReference {
  readonly providerId: string;
  readonly resourceId: string;
  readonly fieldPath: readonly string[];
}
export interface SourceOption {
  readonly reference: SourceReference;
  readonly label: string;
  readonly types: readonly string[];
}
export interface SourceGroup {
  readonly description?: string;
  readonly id: string;
  readonly label: string;
  readonly options: readonly SourceOption[];
}
export interface SourceContext {
  readonly blueprint: Blueprint;
  readonly dependencies: DependencyGraph;
  readonly targetForm: FormInstance;
  readonly targetField: FormField;
}
export interface SourceProvider {
  readonly id: string;
  validateSettings?(settings: unknown): void;
  getGroups(
    context: SourceContext,
    settings: unknown,
    signal: AbortSignal,
  ): Promise<readonly SourceGroup[]>;
}
export interface SourceSelection {
  readonly id: string;
  readonly settings?: unknown;
}
export type ProviderResult =
  | {
      readonly providerId: string;
      readonly status: "success";
      readonly groups: readonly SourceGroup[];
    }
  | { readonly providerId: string; readonly status: "error"; readonly message: string };

// Segment arrays distinguish a literal "contact.email" key from a nested path.
export function sourceReferenceKey(reference: SourceReference): string {
  return JSON.stringify([reference.providerId, reference.resourceId, reference.fieldPath]);
}
