import type { CatalogState, SourceReference, SourceSelection } from "../sources/model";
import { findSourceOption, formatSourceLabel, getSuccessfulGroups } from "../sources/catalog";

export type MappingAvailability =
  | { readonly status: "unmapped" }
  | { readonly status: "checking" }
  | { readonly status: "available"; readonly label: string }
  | {
      readonly status: "unavailable";
      readonly reason: "configuration" | "disabled" | "failed" | "missing";
      readonly message: string;
    };

export function getMappingAvailability(
  mapping: SourceReference | undefined,
  selections: readonly SourceSelection[] | undefined,
  catalog: CatalogState,
): MappingAvailability {
  if (!mapping) return { status: "unmapped" };
  if (selections === undefined) {
    return {
      status: "unavailable",
      reason: "configuration",
      message: "Source availability unknown: configuration is unavailable.",
    };
  }
  if (!selections.some((selection) => selection.id === mapping.providerId)) {
    return {
      status: "unavailable",
      reason: "disabled",
      message: "Source unavailable: provider is disabled.",
    };
  }
  if (catalog.status === "idle" || catalog.status === "loading") return { status: "checking" };
  if (
    catalog.status === "error" ||
    catalog.results.some(
      (result) => result.providerId === mapping.providerId && result.status === "error",
    )
  ) {
    return {
      status: "unavailable",
      reason: "failed",
      message: "Source unavailable: provider could not be loaded.",
    };
  }
  const selected = findSourceOption(getSuccessfulGroups(catalog.results), mapping);
  if (selected) return { status: "available", label: formatSourceLabel(selected) };
  return {
    status: "unavailable",
    reason: "missing",
    message: "Source unavailable: this field is no longer offered.",
  };
}
