import { describe, expect, it } from "vitest";
import { blueprintFixture } from "../test/blueprintFixture";
import { normalizeBlueprint } from "./normalizeBlueprint";

const definition = (properties: unknown) => [{ id: "shared", field_schema: { properties } }];
const node = (data: unknown) => [{ id: "a", type: "form", data }];

describe("blueprint normalization", () => {
  it("joins instance IDs to definitions without collapsing reused definitions", () => {
    const graph = normalizeBlueprint(blueprintFixture());
    expect(graph.forms.map((form) => [form.nodeId, form.definitionId, form.name])).toEqual([
      ["node-a", "shared", "Form A"], ["node-b", "shared", "Form B"], ["node-c", "other", "Form C"],
    ]);
    expect(graph.forms[0]?.fields).toEqual(graph.forms[1]?.fields);
    expect(graph.forms[2]?.fields.map((field) => field.key)).toEqual(["age"]);
  });

  it("extracts labels, raw keys, types, required state and button metadata", () => {
    const fields = normalizeBlueprint(blueprintFixture()).forms[0]?.fields;
    expect(fields).toEqual([
      { key: "email", label: "Email address", types: ["string"], required: true, controlType: "short-text" },
      { key: "preferences", label: "preferences", types: ["array"], required: false, controlType: null },
      { key: "profile", label: "Profile", types: ["object"], required: false, controlType: null },
      { key: "submit", label: "Submit", types: ["object"], required: false, controlType: "button" },
    ]);
  });

  it("does not mutate the input", () => {
    const fixture = blueprintFixture();
    const before = JSON.stringify(fixture);
    normalizeBlueprint(fixture);
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it("accepts an empty graph and uses the ID when a blueprint name is absent", () => {
    expect(normalizeBlueprint({ id: "empty", forms: [], nodes: [], edges: [] }))
      .toEqual({ id: "empty", name: "empty", forms: [], nodes: [], edges: [] });
  });

  it("retains non-form nodes and dependencies without adding them to the form list", () => {
    const fixture = blueprintFixture();
    const graph = normalizeBlueprint({ ...fixture, nodes: [...fixture.nodes, { id: "action", type: "action" }] });
    expect(graph.forms).toHaveLength(3);
    expect(graph.nodes[3]).toEqual({ id: "action", type: "action", prerequisites: null });
    expect(graph.nodes[1]?.prerequisites).toEqual(["node-a"]);
    expect(graph.edges).toEqual(fixture.edges);
  });

  it("supports empty fields, union types, blank title fallback and unspecified type metadata", () => {
    const base = { id: "types", nodes: node({ component_id: "shared", name: "Types" }), edges: [] };
    expect(normalizeBlueprint({ ...base, forms: definition({}) }).forms[0]?.fields).toEqual([]);
    const fields = normalizeBlueprint({ ...base, forms: definition({
      nullable: { type: ["string", "null"], title: " " }, free: {},
    }) }).forms[0]?.fields;
    expect(fields?.[0]).toMatchObject({ label: "nullable", types: ["string", "null"] });
    expect(fields?.[1]).toMatchObject({ label: "free", types: [] });
  });

  it("handles prototype-like IDs and dotted property keys as literal strings", () => {
    const graph = normalizeBlueprint({
      id: "safe", edges: [], nodes: node({ component_id: "__proto__", name: "Safe" }),
      forms: [{ id: "__proto__", field_schema: { properties: JSON.parse('{"__proto__":{"type":"string"},"a.b":{"type":"object"}}') } }],
    });
    expect(graph.forms[0]?.fields.map((field) => field.key)).toEqual(["__proto__", "a.b"]);
  });

  const invalid: [string, unknown, string][] = [
    ["null response", null, "response must be an object"],
    ["array response", [], "response must be an object"],
    ["missing ID", { ...blueprintFixture(), id: undefined }, "id must be"],
    ["blank ID", { ...blueprintFixture(), id: " " }, "id must be"],
    ["invalid name", { ...blueprintFixture(), name: 1 }, "name must be"],
    ["missing nodes", { ...blueprintFixture(), nodes: undefined }, "nodes must be an array"],
    ["invalid forms", { ...blueprintFixture(), forms: {} }, "forms must be an array"],
    ["missing edges", { ...blueprintFixture(), edges: undefined }, "edges must be an array"],
    ["invalid node", { ...blueprintFixture(), nodes: [null] }, "nodes[0] must be an object"],
    ["invalid node type", { ...blueprintFixture(), nodes: [{ id: "a", type: 5 }] }, "nodes[0].type"],
    ["missing node data", { ...blueprintFixture(), nodes: node(undefined) }, "nodes[0].data"],
    ["missing instance name", { ...blueprintFixture(), nodes: node({ component_id: "shared" }) }, "data.name"],
    ["missing definition reference", { ...blueprintFixture(), nodes: node({ name: "A" }) }, "component_id"],
    ["unresolved definition", { ...blueprintFixture(), nodes: node({ name: "A", component_id: "absent" }) }, "missing form definition"],
    ["invalid prerequisites", { ...blueprintFixture(), nodes: node({ name: "A", component_id: "shared", prerequisites: [3] }) }, "prerequisites entry"],
    ["duplicate nodes", { ...blueprintFixture(), nodes: [blueprintFixture().nodes[0], blueprintFixture().nodes[0]] }, "duplicate ID"],
    ["duplicate definitions", { ...blueprintFixture(), forms: [blueprintFixture().forms[0], blueprintFixture().forms[0]] }, "duplicate ID"],
    ["missing field schema", { ...blueprintFixture(), forms: [{ id: "shared" }] }, "field_schema"],
    ["missing properties", { ...blueprintFixture(), forms: [{ id: "shared", field_schema: {} }] }, "properties"],
    ["invalid property", { ...blueprintFixture(), forms: definition({ email: null }) }, "must be an object"],
    ["invalid title", { ...blueprintFixture(), forms: definition({ email: { title: 9 } }) }, "title"],
    ["invalid field type", { ...blueprintFixture(), forms: definition({ email: { type: "banana" } }) }, "type is unsupported"],
    ["empty type union", { ...blueprintFixture(), forms: definition({ email: { type: [] } }) }, "type is unsupported"],
    ["invalid required list", { ...blueprintFixture(), forms: [{ id: "shared", field_schema: { properties: {}, required: [false] } }] }, "required entry"],
    ["invalid control metadata", { ...blueprintFixture(), forms: definition({ email: { avantos_type: 42 } }) }, "avantos_type"],
    ["invalid edge", { ...blueprintFixture(), edges: [{ source: 5, target: "a" }] }, "edges[0].source"],
    ["missing edge target", { ...blueprintFixture(), edges: [{ source: "a" }] }, "edges[0].target"],
  ];
  it.each(invalid)("rejects %s with an actionable validation error", (_name, input, message) => {
    expect(() => normalizeBlueprint(input)).toThrow(message);
    expect(() => normalizeBlueprint(input)).toThrow("Check the server response and try again");
  });
});
