import { describe, expect, it, vi } from "vitest";
import type { Blueprint } from "../blueprint/model";
import { createDependencyGraph } from "../dependencies/createDependencyGraph";
import { dependencyFixture } from "../test/dependencyFixture";
import { loadSourceCatalog } from "./loadSourceCatalog";
import { sourceReferenceKey } from "./model";
import type { SourceContext, SourceGroup, SourceProvider } from "./model";
import { createSourceRegistry, sourceRegistry } from "./registry";

const all = ["direct-forms", "indirect-forms", "global-properties"].map((id) => ({ id }));
function fixture(): Blueprint {
  const graph = dependencyFixture();
  return { ...graph, forms: graph.forms.map((form) => ({ ...form, fields: [
    { key: "email", label: "Email", types: ["string"], controlType: null, required: false },
    { key: "contact.email", label: "Contact", types: ["object", "null"], controlType: null, required: false },
    { key: "button", label: "Submit", types: ["string"], controlType: "button", required: false },
  ] })) };
}
function context(target = "D", blueprint = fixture()): SourceContext {
  const targetForm = blueprint.forms.find((form) => form.nodeId === target)!;
  return { blueprint, dependencies: createDependencyGraph(blueprint), targetForm, targetField: targetForm.fields[0]! };
}
const signal = () => new AbortController().signal;
const group = (id = "fourth"): SourceGroup => ({ id: "group", label: "Extra", options: [{
  reference: { providerId: id, resourceId: "resource", fieldPath: ["value"] }, label: "Value", types: ["string"],
}] });
const provider = (id = "fourth"): SourceProvider => ({ id, getGroups: async () => [group(id)] });

describe("built-in source providers", () => {
  it.each([
    ["A", [], []], ["B", ["A"], []], ["D", ["B"], ["A"]],
    ["F", ["D", "E"], ["A", "B", "C"]],
  ])("returns eligible form groups for %s", async (target, direct, indirect) => {
    const result = await loadSourceCatalog(sourceRegistry, all, context(target as string), signal());
    expect(result.map((entry) => entry.status === "success" && entry.groups.map((g) => g.id)))
      .toEqual([direct, indirect, ["sample-organization"]]);
  });
  it("preserves field metadata, literal keys, button outputs and instance identity", async () => {
    const result = await loadSourceCatalog(sourceRegistry, all, context("F"), signal());
    const direct = result[0]!;
    if (direct.status !== "success") throw new Error("Expected success");
    expect(direct.groups.map((g) => g.options[0]!.reference.resourceId)).toEqual(["D", "E"]);
    expect(direct.groups[0]!.options[1]).toEqual({ reference: {
      providerId: "direct-forms", resourceId: "D", fieldPath: ["contact.email"],
    }, label: "Contact", types: ["object", "null"] });
    expect(direct.groups[0]!.options[2]!.label).toBe("Submit");
  });
  it("omits empty forms but still reaches their ancestors", async () => {
    const blueprint = fixture();
    const changed = { ...blueprint, forms: blueprint.forms.map((f) => f.nodeId === "B" ? { ...f, fields: [] } : f) };
    const results = await loadSourceCatalog(sourceRegistry, all, context("D", changed), signal());
    expect(results[0]).toMatchObject({ status: "success", groups: [] });
    expect(results[1]).toMatchObject({ status: "success", groups: [{ id: "A" }] });
  });
  it("traverses non-form nodes without offering them", async () => {
    const blueprint = fixture();
    const changed = { ...blueprint, forms: blueprint.forms.filter((f) => f.nodeId !== "B"),
      nodes: blueprint.nodes.map((n) => n.id === "B" ? { ...n, type: "action" } : n) };
    const results = await loadSourceCatalog(sourceRegistry, all, context("D", changed), signal());
    expect(results[0]).toMatchObject({ status: "success", groups: [] });
    expect(results[1]).toMatchObject({ status: "success", groups: [{ id: "A" }] });
  });
  it.each(all)("rejects unsupported settings for $id", async ({ id }) => {
    expect(await loadSourceCatalog(sourceRegistry, [{ id, settings: {} }], context(), signal()))
      .toEqual([{ providerId: id, status: "error", message: "This provider does not accept settings." }]);
  });
  it("does not mutate the blueprint and creates fresh options", async () => {
    const ctx = context();
    const before = JSON.stringify(ctx.blueprint);
    const first = await loadSourceCatalog(sourceRegistry, all, ctx, signal());
    const second = await loadSourceCatalog(sourceRegistry, all, ctx, signal());
    expect(first).toEqual(second);
    expect(first[0]).not.toBe(second[0]);
    expect(JSON.stringify(ctx.blueprint)).toBe(before);
  });
  it("keeps references stable when display labels change", async () => {
    const ctx = context();
    const changed = { ...ctx.blueprint, forms: ctx.blueprint.forms.map((f) => ({ ...f, name: "Renamed", fields: f.fields.map((field) => ({ ...field, label: "Renamed" })) })) };
    const refs = async (c: SourceContext) => (await loadSourceCatalog(sourceRegistry, all, c, signal()))
      .flatMap((r) => r.status === "success" ? r.groups.flatMap((g) => g.options.map((o) => o.reference)) : []);
    expect(await refs(ctx)).toEqual(await refs(context("D", changed)));
  });
});

describe("registry and catalog", () => {
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("supports source subset %i", async (mask) => {
    const selections = all.filter((_, index) => mask & (1 << index));
    const result = await loadSourceCatalog(sourceRegistry, selections, context(), signal());
    expect(result.map((r) => r.providerId)).toEqual(selections.map((s) => s.id));
    expect(result.every((r) => r.status === "success")).toBe(true);
  });
  it("registers a fourth provider and passes settings, context and signal unchanged", async () => {
    const custom = { id: "fourth", getGroups: vi.fn(async () => [group()]) };
    const ctx = context(); const abortSignal = signal(); const settings = { tenant: "sample" };
    const result = await loadSourceCatalog(createSourceRegistry([custom]), [{ id: "fourth", settings }], ctx, abortSignal);
    expect(custom.getGroups).toHaveBeenCalledWith(ctx, settings, abortSignal);
    expect(result).toEqual([{ providerId: "fourth", status: "success", groups: [group()] }]);
  });
  it("rejects invalid selections before calling any provider", async () => {
    const custom = { id: "fourth", getGroups: vi.fn(async () => []) };
    const registry = createSourceRegistry([custom]);
    await expect(loadSourceCatalog(registry, [{ id: "fourth" }, { id: "unknown" }], context(), signal())).rejects.toThrow("Unknown");
    await expect(loadSourceCatalog(registry, [{ id: "fourth" }, { id: "fourth" }], context(), signal())).rejects.toThrow("Duplicate");
    expect(custom.getGroups).not.toHaveBeenCalled();
  });
  it("rejects duplicate and blank registration IDs", () => {
    expect(() => createSourceRegistry([provider(), provider()])).toThrow("unique");
    expect(() => createSourceRegistry([provider(" ")])).toThrow("nonempty");
  });
  it("rejects a stale target before invoking providers", async () => {
    const ctx = context();
    await expect(loadSourceCatalog(sourceRegistry, all, { ...ctx, targetForm: { ...ctx.targetForm } }, signal())).rejects.toThrow("target");
    await expect(loadSourceCatalog(sourceRegistry, all, { ...ctx, targetField: { ...ctx.targetField } }, signal())).rejects.toThrow("target");
  });
  it.each([true, false])("isolates a provider failure (synchronous: %s)", async (sync) => {
    const failing: SourceProvider = { id: "broken", getGroups: () => {
      if (sync) throw new Error("Unavailable");
      return Promise.reject("Unavailable");
    } };
    const result = await loadSourceCatalog(createSourceRegistry([failing, provider()]), [{ id: "broken" }, { id: "fourth" }], context(), signal());
    expect(result[0]).toMatchObject({ providerId: "broken", status: "error" });
    expect(result[1]).toMatchObject({ providerId: "fourth", status: "success" });
  });
  it("starts providers concurrently while preserving requested order", async () => {
    let finish!: (groups: readonly SourceGroup[]) => void;
    const slow: SourceProvider = { id: "slow", getGroups: () => new Promise((resolve) => { finish = resolve; }) };
    const fast = { id: "fast", getGroups: vi.fn(async () => []) };
    const pending = loadSourceCatalog(createSourceRegistry([fast, slow]), [{ id: "slow" }, { id: "fast" }], context(), signal());
    await Promise.resolve();
    expect(fast.getGroups).toHaveBeenCalledOnce();
    finish([]);
    expect((await pending).map((r) => r.providerId)).toEqual(["slow", "fast"]);
  });
  it("does not start a pre-cancelled request", async () => {
    const custom = { id: "fourth", getGroups: vi.fn(async () => []) };
    const controller = new AbortController(); controller.abort();
    await expect(loadSourceCatalog(createSourceRegistry([custom]), [{ id: "fourth" }], context(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(custom.getGroups).not.toHaveBeenCalled();
  });
  it.each(["resolve", "reject"])("cancels an uncooperative provider and ignores late %s", async (outcome) => {
    let finish!: (groups: readonly SourceGroup[]) => void;
    let fail!: (reason: unknown) => void;
    const custom: SourceProvider = { id: "fourth", getGroups: () => new Promise((resolve, reject) => { finish = resolve; fail = reject; }) };
    const controller = new AbortController();
    const pending = loadSourceCatalog(createSourceRegistry([custom]), [{ id: "fourth" }], context(), controller.signal);
    await Promise.resolve(); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    if (outcome === "resolve") finish([group()]); else fail(new Error("late failure"));
    await Promise.resolve();
  });
  it.each(["groups", "references", "namespace", "path", "resource"])("isolates malformed provider %s", async (kind) => {
    const original = group();
    const option = original.options[0]!;
    let groups: readonly SourceGroup[] = [original];
    if (kind === "groups") groups = [original, original];
    if (kind === "references") groups = [{ ...original, options: [option, option] }];
    if (kind === "namespace") groups = [group("wrong")];
    if (kind === "path") groups = [{ ...original, options: [{ ...option, reference: { ...option.reference, fieldPath: [] } }] }];
    if (kind === "resource") groups = [{ ...original, options: [{ ...option, reference: { ...option.reference, resourceId: "" } }] }];
    const custom: SourceProvider = { id: "fourth", getGroups: async () => groups };
    expect(await loadSourceCatalog(createSourceRegistry([custom]), [{ id: "fourth" }], context(), signal()))
      .toEqual([expect.objectContaining({ status: "error" })]);
  });
  it("encodes path boundaries and provider namespaces without collisions", () => {
    const reference = { providerId: "one", resourceId: "node", fieldPath: ["contact.email"] };
    expect(sourceReferenceKey(reference)).not.toBe(sourceReferenceKey({ ...reference, fieldPath: ["contact", "email"] }));
    expect(sourceReferenceKey(reference)).not.toBe(sourceReferenceKey({ ...reference, providerId: "two" }));
  });
});
