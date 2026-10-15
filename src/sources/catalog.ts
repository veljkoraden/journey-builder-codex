import type { ProviderResult, SourceGroup, SourceOption, SourceReference } from "./model";
import { sourceReferenceKey } from "./model";

export interface CatalogGroup extends SourceGroup {
  readonly providerId: string;
}

export interface CatalogOption {
  readonly group: CatalogGroup;
  readonly option: SourceOption;
}

export function getSuccessfulGroups(results: readonly ProviderResult[]): readonly CatalogGroup[] {
  return results.flatMap((result) =>
    result.status === "success"
      ? result.groups.map((group) => ({ ...group, providerId: result.providerId }))
      : [],
  );
}

export function findSourceOption(
  groups: readonly CatalogGroup[],
  reference: SourceReference,
): CatalogOption | undefined {
  return findSourceOptionByKey(groups, sourceReferenceKey(reference));
}

export function findSourceOptionByKey(
  groups: readonly CatalogGroup[],
  selectedKey: string | null,
): CatalogOption | undefined {
  if (selectedKey === null) return undefined;
  for (const group of groups) {
    const option = group.options.find(
      (candidate) => sourceReferenceKey(candidate.reference) === selectedKey,
    );
    if (option) return { group, option };
  }
  return undefined;
}

export function formatSourceLabel({ group, option }: CatalogOption): string {
  return `${group.label} · ${option.label}`;
}

export function normalizeSourceQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

// Keep empty groups in the result so React can retain each group's expansion state.
// The group component hides itself when it has no matching options.
export function filterSourceGroups(
  groups: readonly CatalogGroup[],
  query: string,
): readonly CatalogGroup[] {
  const term = normalizeSourceQuery(query);
  return groups.map((group) => {
    if (group.label.toLocaleLowerCase().includes(term)) return group;
    return {
      ...group,
      options: group.options.filter((option) => option.label.toLocaleLowerCase().includes(term)),
    };
  });
}

export function hasSourceOptions(groups: readonly CatalogGroup[]): boolean {
  return groups.some((group) => group.options.length > 0);
}
