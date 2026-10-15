import { expect, it } from "vitest";
import { dependencyFixture } from "../test/dependencyFixture";
import { createMappingState, mappingReducer } from "./reducer";
import { summarizeMappings } from "./summarizeMappings";

const original = dependencyFixture();
const blueprint = {
  ...original,
  forms: original.forms.map((form) => ({
    ...form,
    fields: [
      { key: "email", label: "Email", types: ["string"], controlType: null, required: false },
      { key: "object", label: "Object", types: ["object"], controlType: null, required: false },
      { key: "button", label: "Button", types: [], controlType: "button", required: false },
    ],
  })),
};
const source = { providerId: "any-provider", resourceId: "resource", fieldPath: ["email"] };
it("counts prefillable targets, including objects but excluding buttons", () => {
  expect(summarizeMappings(blueprint, createMappingState()).get("D")).toEqual({
    mapped: 0,
    total: 2,
  });
});
it("isolates shared definitions and excludes other blueprints and obsolete fields", () => {
  let state = createMappingState();
  for (const [blueprintId, nodeId, fieldKey] of [
    [blueprint.id, "D", "email"],
    [blueprint.id, "D", "button"],
    [blueprint.id, "D", "removed"],
    ["another", "E", "email"],
    [blueprint.id, "removed-node", "email"],
  ])
    state = mappingReducer(state, {
      type: "set",
      target: { blueprintId: blueprintId!, nodeId: nodeId!, fieldKey: fieldKey! },
      source,
    });
  const counts = summarizeMappings(blueprint, state);
  expect(counts.get("D")).toEqual({ mapped: 1, total: 2 });
  expect(counts.get("E")).toEqual({ mapped: 0, total: 2 });
  expect(counts.has("removed-node")).toBe(false);
});
it("counts saved references even if their provider is unavailable", () => {
  const state = mappingReducer(createMappingState(), {
    type: "set",
    target: { blueprintId: blueprint.id, nodeId: "D", fieldKey: "email" },
    source,
  });
  expect(summarizeMappings(blueprint, state).get("D")?.mapped).toBe(1);
});
it("handles empty forms and an empty blueprint", () => {
  expect(summarizeMappings({ ...blueprint, forms: [] }, createMappingState()).size).toBe(0);
  expect(
    summarizeMappings(
      { ...blueprint, forms: blueprint.forms.map((form) => ({ ...form, fields: [] })) },
      createMappingState(),
    ).get("D"),
  ).toEqual({ mapped: 0, total: 0 });
});
it("does not count replacing a mapping as an additional field", () => {
  const target = { blueprintId: blueprint.id, nodeId: "D", fieldKey: "email" };
  const mapped = mappingReducer(createMappingState(), { type: "set", target, source });
  const replaced = mappingReducer(mapped, {
    type: "set",
    target,
    source: { ...source, resourceId: "other" },
  });
  expect(summarizeMappings(blueprint, replaced).get("D")?.mapped).toBe(1);
  const cleared = mappingReducer(replaced, { type: "clear", target });
  expect(summarizeMappings(blueprint, cleared).get("D")?.mapped).toBe(0);
});
