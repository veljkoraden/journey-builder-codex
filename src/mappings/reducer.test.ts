import { describe, expect, it } from "vitest";
import type { SourceReference } from "../sources/model";
import type { MappingState, MappingTarget } from "./model";
import { mappingTargetKey } from "./model";
import { createMappingState, getMapping, getSavedMapping, mappingReducer } from "./reducer";

const target: MappingTarget = { blueprintId: "blueprint", nodeId: "D", fieldKey: "email" };
const source: SourceReference = {
  providerId: "indirect-forms",
  resourceId: "A",
  fieldPath: ["email"],
};
const replacement: SourceReference = {
  providerId: "global-properties",
  resourceId: "organization",
  fieldPath: ["support_email"],
};
function set(state: MappingState, destination = target, reference = source) {
  return mappingReducer(state, { type: "set", target: destination, source: reference });
}

describe("mapping state", () => {
  it("starts empty and returns undefined for an unmapped field", () => {
    expect(getMapping(createMappingState(), target)).toBeUndefined();
  });
  it("sets, replaces and clears a mapping", () => {
    const initial = createMappingState();
    const mapped = set(initial);
    const replaced = set(mapped, target, replacement);
    const cleared = mappingReducer(replaced, { type: "clear", target });
    expect(getMapping(mapped, target)).toEqual(source);
    expect(getMapping(replaced, target)).toEqual(replacement);
    expect(getMapping(cleared, target)).toBeUndefined();
    expect(getMapping(initial, target)).toBeUndefined();
    expect(Object.keys(cleared)).toHaveLength(0);
  });
  it.each([
    { ...target, blueprintId: "another" },
    { ...target, nodeId: "E" },
    { ...target, fieldKey: "name" },
  ])("isolates changes from another target %j", (other) => {
    const both = set(set(createMappingState()), other, replacement);
    const updated = set(both, target, { ...source, resourceId: "B" });
    const cleared = mappingReducer(updated, { type: "clear", target });
    expect(getMapping(updated, other)).toEqual(replacement);
    expect(getMapping(cleared, other)).toEqual(replacement);
    expect(getMapping(cleared, target)).toBeUndefined();
    expect(getMapping(both, target)).toEqual(source);
  });
  it("keeps separate instances even if they share a form definition", () => {
    const definitionId = "shared-template";
    const instances = ["D", "E"].map((nodeId) => ({ nodeId, definitionId }));
    const first = { ...target, nodeId: instances[0]!.nodeId };
    const second = { ...target, nodeId: instances[1]!.nodeId };
    const state = set(set(createMappingState(), first), second, replacement);
    expect(getMapping(state, first)).toEqual(source);
    expect(getMapping(state, second)).toEqual(replacement);
  });
  it("clearing an unmapped target is safe and leaves existing entries alone", () => {
    const state = set(createMappingState());
    expect(mappingReducer(state, { type: "clear", target: { ...target, nodeId: "missing" } })).toBe(
      state,
    );
  });
  it("reselecting the same reference is a no-op, regardless of object identity", () => {
    const state = set(createMappingState());
    expect(set(state, { ...target }, { ...source, fieldPath: [...source.fieldPath] })).toBe(state);
  });
  it.each([
    { ...source, providerId: "other-provider" },
    { ...source, resourceId: "other-resource" },
    { ...source, fieldPath: ["email", "value"] },
  ])("replaces when any source identity segment changes: %j", (next) => {
    const state = set(createMappingState());
    expect(getMapping(set(state, target, next), target)).toEqual(next);
    expect(getMapping(state, target)).toEqual(source);
  });
  it.each(["__proto__", "constructor", "toString", "a.b", "a:b", 'a"b', "a/b", "", "顧客"])(
    "supports literal target keys %j",
    (fieldKey) => {
      const special = { blueprintId: fieldKey, nodeId: fieldKey, fieldKey };
      const state = set(set(createMappingState()), special, replacement);
      expect(getMapping(state, special)).toEqual(replacement);
      expect(getMapping(state, target)).toEqual(source);
      expect(getMapping(mappingReducer(state, { type: "clear", target: special }), target)).toEqual(
        source,
      );
    },
  );
  it("does not collide when delimiters move between target identity parts", () => {
    const left = { blueprintId: "a:b", nodeId: "c", fieldKey: "d" };
    const right = { blueprintId: "a", nodeId: "b:c", fieldKey: "d" };
    expect(mappingTargetKey(left)).not.toBe(mappingTargetKey(right));
    const state = set(set(createMappingState(), left), right, replacement);
    expect(getMapping(state, left)).toEqual(source);
    expect(getMapping(state, right)).toEqual(replacement);
  });
  it("preserves nested paths separately from literal dotted keys", () => {
    const literal = { ...source, fieldPath: ["contact.email"] };
    const nested = { ...source, fieldPath: ["contact", "email"] };
    const state = set(createMappingState(), target, literal);
    expect(getMapping(set(state, target, nested), target)?.fieldPath).toEqual(["contact", "email"]);
    expect(getMapping(state, target)?.fieldPath).toEqual(["contact.email"]);
  });
  it("copies action-owned references and paths before storing them", () => {
    const mutable = { ...source, fieldPath: ["email"] };
    const destination = { ...target };
    const state = set(createMappingState(), destination, mutable);
    mutable.providerId = "changed";
    mutable.fieldPath.push("changed");
    destination.nodeId = "changed";
    expect(getMapping(state, target)).toEqual(source);
  });
  it("protects stored references and previous state from consumer mutation", () => {
    const state = set(createMappingState());
    const stored = getMapping(state, target)!;
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.fieldPath)).toBe(true);
    expect(() => (stored.fieldPath as string[]).push("changed")).toThrow();
    expect(getMapping(state, target)).toEqual(source);
  });
  it("does not mutate frozen actions, sources or targets", () => {
    const action = Object.freeze({
      type: "set" as const,
      target: Object.freeze({ ...target }),
      source: Object.freeze({ ...source, fieldPath: Object.freeze(["email"]) }),
    });
    expect(getMapping(mappingReducer(createMappingState(), action), target)).toEqual(source);
  });
  it("retains references when a provider is later unavailable", () => {
    // Availability belongs to the catalog/UI. The state layer must not erase edits.
    const unknown = { ...source, providerId: "temporarily-disabled" };
    const state = set(createMappingState(), target, unknown);
    expect(getMapping(state, target)).toEqual(unknown);
    expect(getMapping(mappingReducer(state, { type: "clear", target }), target)).toBeUndefined();
  });
  it("supports repeated independent edits against a simple reference model", () => {
    const targets = ["bp-1", "bp-2", "bp-3"].flatMap((blueprintId) =>
      ["A", "B", "C"].flatMap((nodeId) =>
        ["email", "object", "array"].map((fieldKey) => ({ blueprintId, nodeId, fieldKey })),
      ),
    );
    const expected: (SourceReference | undefined)[] = Array.from({ length: targets.length });
    let state = createMappingState();
    let seed = 12345;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let step = 0; step < 500; step += 1) {
      const index = random() % targets.length;
      const destination = targets[index]!;
      const previous = state;
      const snapshot = JSON.stringify(previous);
      if (random() % 3 === 0) {
        state = mappingReducer(state, { type: "clear", target: destination });
        expected[index] = undefined;
      } else {
        const next = { ...source, resourceId: `source-${random() % 5}` };
        state = set(state, destination, next);
        expected[index] = next;
      }
      targets.forEach((entry, i) => expect(getMapping(state, entry)).toEqual(expected[i]));
      expect(JSON.stringify(previous)).toBe(snapshot);
    }
  });
});

describe("mapping label snapshots", () => {
  it("saves source and label atomically and clears both", () => {
    const state = mappingReducer(createMappingState(), {
      type: "set",
      target,
      source,
      fallbackLabel: "Form A · Email",
    });
    expect(getSavedMapping(state, target)).toEqual({ source, fallbackLabel: "Form A · Email" });
    expect(Object.isFrozen(getSavedMapping(state, target))).toBe(true);
    expect(
      getSavedMapping(mappingReducer(state, { type: "clear", target }), target),
    ).toBeUndefined();
  });
  it("updates a label without changing source identity and skips identical confirmations", () => {
    const action = { type: "set" as const, target, source, fallbackLabel: "Old label" };
    const state = mappingReducer(createMappingState(), action);
    expect(mappingReducer(state, { ...action, source: { ...source } })).toBe(state);
    const updated = mappingReducer(state, { ...action, fallbackLabel: "New label" });
    expect(getSavedMapping(updated, target)?.fallbackLabel).toBe("New label");
    expect(getMapping(updated, target)).toBe(getMapping(state, target));
    expect(getSavedMapping(state, target)?.fallbackLabel).toBe("Old label");
  });
  it("keeps labels isolated for targets sharing one source", () => {
    const other = { ...target, fieldKey: "name" };
    const first = mappingReducer(createMappingState(), {
      type: "set",
      target,
      source,
      fallbackLabel: "Email label",
    });
    const both = mappingReducer(first, {
      type: "set",
      target: other,
      source,
      fallbackLabel: "Name label",
    });
    expect(getSavedMapping(both, target)?.fallbackLabel).toBe("Email label");
    expect(getSavedMapping(both, other)?.fallbackLabel).toBe("Name label");
    const cleared = mappingReducer(both, { type: "clear", target: other });
    expect(getSavedMapping(cleared, target)).toBe(getSavedMapping(both, target));
  });
  it("does not retain a previous label when replacing with an unlabeled source", () => {
    const state = mappingReducer(createMappingState(), {
      type: "set",
      target,
      source,
      fallbackLabel: "Old label",
    });
    const replaced = mappingReducer(state, { type: "set", target, source: replacement });
    expect(getSavedMapping(replaced, target)).toEqual({
      source: replacement,
      fallbackLabel: undefined,
    });
  });
});
