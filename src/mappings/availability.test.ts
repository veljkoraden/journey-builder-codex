import { describe, expect, it } from "vitest";
import type { CatalogState, SourceReference } from "../sources/model";
import { getMappingAvailability } from "./availability";

const mapping: SourceReference = {
  providerId: "directory",
  resourceId: "team",
  fieldPath: ["email"],
};
const enabled = [{ id: "directory" }];
const catalog = (label = "Team"): CatalogState => ({
  status: "success",
  results: [
    {
      providerId: "directory",
      status: "success",
      groups: [
        { id: "team", label, options: [{ reference: mapping, label: "Email", types: ["string"] }] },
      ],
    },
  ],
});

describe("mapping availability decisions", () => {
  it("does not report a source problem for an unmapped field", () => {
    expect(
      getMappingAvailability(undefined, undefined, { status: "error", message: "Offline" }),
    ).toEqual({ status: "unmapped" });
  });
  it("prioritizes unavailable configuration over an old catalog", () => {
    expect(getMappingAvailability(mapping, undefined, catalog())).toMatchObject({
      status: "unavailable",
      reason: "configuration",
    });
  });
  it("prioritizes disabled providers over old success or failure", () => {
    for (const state of [catalog(), { status: "error", message: "Offline" } as const]) {
      expect(getMappingAvailability(mapping, [], state)).toMatchObject({
        status: "unavailable",
        reason: "disabled",
      });
    }
  });
  it.each(["idle", "loading"] as const)("treats %s as unresolved, not missing", (status) => {
    expect(getMappingAvailability(mapping, enabled, { status })).toEqual({ status: "checking" });
  });
  it.each([
    { status: "error", message: "Offline" },
    {
      status: "success",
      results: [{ providerId: "directory", status: "error", message: "Offline" }],
    },
  ] satisfies CatalogState[])(
    "reports catalog/provider errors as retryable failures %#",
    (state) => {
      expect(getMappingAvailability(mapping, enabled, state)).toMatchObject({
        status: "unavailable",
        reason: "failed",
      });
    },
  );
  it("uses current labels without changing the saved identity", () => {
    const before = structuredClone(mapping);
    expect(getMappingAvailability(mapping, enabled, catalog("Renamed"))).toEqual({
      status: "available",
      label: "Renamed · Email",
    });
    expect(mapping).toEqual(before);
  });
  it("keeps a healthy mapping available when a different provider fails", () => {
    const state = catalog();
    if (state.status !== "success") throw Error("Expected success fixture");
    expect(
      getMappingAvailability(mapping, enabled, {
        status: "success",
        results: [...state.results, { providerId: "other", status: "error", message: "Offline" }],
      }),
    ).toMatchObject({ status: "available" });
  });
  it("reports missing references without changing the saved mapping", () => {
    expect(
      getMappingAvailability(mapping, enabled, { status: "success", results: [] }),
    ).toMatchObject({ status: "unavailable", reason: "missing" });
    expect(mapping.fieldPath).toEqual(["email"]);
  });
  it("does not accept an identically named field from another provider", () => {
    const state: CatalogState = {
      status: "success",
      results: [
        {
          providerId: "other",
          status: "success",
          groups: [
            {
              id: "team",
              label: "Team",
              options: [
                { label: "Email", types: [], reference: { ...mapping, providerId: "other" } },
              ],
            },
          ],
        },
      ],
    };
    expect(getMappingAvailability(mapping, enabled, state)).toMatchObject({ reason: "missing" });
  });
});
