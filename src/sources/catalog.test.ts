import { describe, expect, it } from "vitest";
import type { ProviderResult, SourceReference } from "./model";
import { sourceReferenceKey } from "./model";
import {
  filterSourceGroups,
  findSourceOption,
  findSourceOptionByKey,
  formatSourceLabel,
  getSuccessfulGroups,
  hasSourceOptions,
} from "./catalog";

const reference = (providerId: string, fieldPath = ["email"]): SourceReference => ({
  providerId,
  resourceId: "shared-resource",
  fieldPath,
});
function results(): readonly ProviderResult[] {
  return [
    {
      providerId: "first",
      status: "success",
      groups: [
        {
          id: "shared",
          label: "Form A",
          options: [
            { label: "Email", types: ["string"], reference: reference("first") },
            { label: "Name", types: ["string"], reference: reference("first", ["name"]) },
          ],
        },
        { id: "empty", label: "Empty", options: [] },
      ],
    },
    { providerId: "failed", status: "error", message: "Unavailable" },
    {
      providerId: "second",
      status: "success",
      groups: [
        {
          id: "shared",
          label: "Team",
          options: [{ label: "Support email", types: ["string"], reference: reference("second") }],
        },
      ],
    },
  ];
}

describe("catalog decisions", () => {
  it("keeps successful groups in provider order with provider identity and empty groups", () => {
    const groups = getSuccessfulGroups(results());
    expect(groups.map(({ providerId, id }) => [providerId, id])).toEqual([
      ["first", "shared"],
      ["first", "empty"],
      ["second", "shared"],
    ]);
  });
  it("distinguishes matching resource/path identities from different providers", () => {
    const groups = getSuccessfulGroups(results());
    expect(formatSourceLabel(findSourceOption(groups, reference("first"))!)).toBe("Form A · Email");
    expect(formatSourceLabel(findSourceOption(groups, reference("second"))!)).toBe(
      "Team · Support email",
    );
  });
  it("does not confuse a dotted field key with a nested path", () => {
    const source = reference("first", ["contact.email"]);
    const groups = [
      {
        providerId: "first",
        id: "g",
        label: "Contact",
        options: [{ reference: source, label: "Email", types: ["string"] }],
      },
    ];
    expect(findSourceOption(groups, reference("first", ["contact", "email"]))).toBeUndefined();
    expect(findSourceOptionByKey(groups, sourceReferenceKey(source))?.option.reference).toEqual(
      source,
    );
  });
  it.each([null, "unknown", ""])("returns no selection for absent/stale key %s", (key) => {
    expect(findSourceOptionByKey(getSuccessfulGroups(results()), key)).toBeUndefined();
  });
  it.each(["", "  ", "\n"])("blank search retains every option (%j)", (query) => {
    const groups = getSuccessfulGroups(results());
    expect(filterSourceGroups(groups, query)).toEqual(groups);
  });
  it("matches group names case-insensitively and retains all their options", () => {
    const filtered = filterSourceGroups(getSuccessfulGroups(results()), "  fOrM A  ");
    expect(filtered.map((group) => group.options.length)).toEqual([2, 0, 0]);
    expect(hasSourceOptions(filtered)).toBe(true);
  });
  it("filters option labels using the same normalized query", () => {
    const filtered = filterSourceGroups(getSuccessfulGroups(results()), " EMAIL ");
    expect(filtered.map((group) => group.options.map((option) => option.label))).toEqual([
      ["Email"],
      [],
      ["Support email"],
    ]);
  });
  it("retains nonmatching group identities to preserve mounted expansion state", () => {
    const groups = getSuccessfulGroups(results());
    const filtered = filterSourceGroups(groups, "not present");
    expect(filtered.map((group) => [group.providerId, group.id])).toEqual(
      groups.map((group) => [group.providerId, group.id]),
    );
    expect(hasSourceOptions(filtered)).toBe(false);
    expect(hasSourceOptions(groups)).toBe(true);
  });
  it("does not treat a matching empty group as a search result", () => {
    expect(hasSourceOptions(filterSourceGroups(getSuccessfulGroups(results()), "Empty"))).toBe(
      false,
    );
    expect(hasSourceOptions([])).toBe(false);
  });
  it("preserves source data and resolves a selected option hidden by search", () => {
    const input = results();
    const before = structuredClone(input);
    const groups = getSuccessfulGroups(input);
    filterSourceGroups(groups, "Name");
    expect(formatSourceLabel(findSourceOption(groups, reference("first"))!)).toBe("Form A · Email");
    expect(input).toEqual(before);
  });
});
