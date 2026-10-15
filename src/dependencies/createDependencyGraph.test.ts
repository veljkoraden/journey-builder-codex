import { describe, expect, it } from "vitest";
import { dependencyFixture } from "../test/dependencyFixture";
import { createDependencyGraph } from "./createDependencyGraph";

const ids = (groups: ReturnType<ReturnType<typeof createDependencyGraph>["getUpstreamForms"]>) => ({
  direct: groups.direct.map((form) => form.nodeId),
  indirect: groups.indirect.map((form) => form.nodeId),
});

describe("dependency queries", () => {
  it.each([
    ["A", [], []],
    ["B", ["A"], []],
    ["C", ["A"], []],
    ["D", ["B"], ["A"]],
    ["E", ["C"], ["A"]],
    ["F", ["D", "E"], ["A", "B", "C"]],
  ])("classifies upstream forms for %s", (target, direct, indirect) => {
    const graph = createDependencyGraph(dependencyFixture());
    expect(ids(graph.getUpstreamForms(target as string))).toEqual({ direct, indirect });
  });

  it("deduplicates an ancestor reached through both sides of a diamond", () => {
    const graph = createDependencyGraph(
      dependencyFixture(
        ["A", "B", "C", "D"],
        [
          ["A", "B"],
          ["A", "C"],
          ["B", "D"],
          ["C", "D"],
        ],
      ),
    );
    expect(graph.getAncestors("D")).toEqual({ direct: ["B", "C"], indirect: ["A"] });
  });

  it("gives direct membership precedence over a longer route", () => {
    const graph = createDependencyGraph(
      dependencyFixture(
        ["A", "B", "C"],
        [
          ["A", "B"],
          ["B", "C"],
          ["A", "C"],
        ],
      ),
    );
    expect(graph.getAncestors("C")).toEqual({ direct: ["A", "B"], indirect: [] });
  });

  it("does not expose descendants, siblings, disconnected nodes, or self", () => {
    const fixture = dependencyFixture();
    const isolated = dependencyFixture(["X"], []);
    const graph = createDependencyGraph({
      ...fixture,
      nodes: [...fixture.nodes, ...isolated.nodes],
      forms: [...fixture.forms, ...isolated.forms],
    });
    expect(graph.getAncestors("D")).toEqual({ direct: ["B"], indirect: ["A"] });
    expect(graph.getAncestors("X")).toEqual({ direct: [], indirect: [] });
  });

  it("traverses non-form nodes without returning them as form sources", () => {
    const fixture = dependencyFixture(
      ["A", "action", "D"],
      [
        ["A", "action"],
        ["action", "D"],
      ],
    );
    const graph = createDependencyGraph({
      ...fixture,
      nodes: fixture.nodes.map((node) =>
        node.id === "action" ? { ...node, type: "action" } : node,
      ),
      forms: fixture.forms.filter((form) => form.nodeId !== "action"),
    });
    expect(graph.getAncestors("D")).toEqual({ direct: ["action"], indirect: ["A"] });
    expect(ids(graph.getUpstreamForms("D"))).toEqual({ direct: [], indirect: ["A"] });
  });

  it("keeps distinct instances with a shared definition and sorts by name then node ID", () => {
    const fixture = dependencyFixture(
      ["Z", "B", "A", "target"],
      [
        ["Z", "target"],
        ["B", "target"],
        ["A", "target"],
      ],
    );
    const graph = createDependencyGraph({
      ...fixture,
      forms: fixture.forms.map((form) => ({
        ...form,
        name: form.nodeId === "Z" ? "First" : "Same",
      })),
    });
    expect(ids(graph.getUpstreamForms("target"))).toEqual({
      direct: ["Z", "A", "B"],
      indirect: [],
    });
  });

  it("is deterministic when nodes and edges arrive in another order", () => {
    const fixture = dependencyFixture();
    const reversed = {
      ...fixture,
      nodes: [...fixture.nodes].reverse(),
      edges: [...fixture.edges].reverse(),
      forms: [...fixture.forms].reverse(),
    };
    expect(ids(createDependencyGraph(reversed).getUpstreamForms("F"))).toEqual(
      ids(createDependencyGraph(fixture).getUpstreamForms("F")),
    );
  });

  it("treats duplicate edges and repeated prerequisites as one relationship", () => {
    const fixture = dependencyFixture(
      ["A", "B"],
      [
        ["A", "B"],
        ["A", "B"],
      ],
    );
    const graph = createDependencyGraph({
      ...fixture,
      nodes: fixture.nodes.map((node) => ({
        ...node,
        prerequisites: node.id === "B" ? ["A", "A"] : [],
      })),
    });
    expect(graph.getAncestors("B")).toEqual({ direct: ["A"], indirect: [] });
  });

  it("accepts missing prerequisite metadata and matching metadata in any order", () => {
    const fixture = dependencyFixture(
      ["A", "B", "C"],
      [
        ["A", "C"],
        ["B", "C"],
      ],
    );
    const graph = createDependencyGraph({
      ...fixture,
      nodes: fixture.nodes.map((node) => ({
        ...node,
        prerequisites: node.id === "C" ? ["B", "A"] : null,
      })),
    });
    expect(graph.getAncestors("C").direct).toEqual(["A", "B"]);
  });

  it("handles an empty graph and rejects unknown query targets", () => {
    const graph = createDependencyGraph(dependencyFixture([], []));
    expect(() => graph.getAncestors("missing")).toThrow("requested node does not exist");
    expect(() => graph.getUpstreamForms("missing")).toThrow("requested node does not exist");
  });

  it("supports prototype-like node IDs without object-key collisions", () => {
    const graph = createDependencyGraph(
      dependencyFixture(["__proto__", "constructor"], [["__proto__", "constructor"]]),
    );
    expect(graph.getAncestors("constructor").direct).toEqual(["__proto__"]);
  });

  it("does not mutate the input or expose mutable result arrays", () => {
    const fixture = dependencyFixture();
    const before = JSON.stringify(fixture);
    const graph = createDependencyGraph(fixture);
    const result = graph.getAncestors("F");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.direct)).toBe(true);
    expect(Object.isFrozen(graph.getUpstreamForms("F").indirect)).toBe(true);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(graph.getAncestors("D")).toEqual({ direct: ["B"], indirect: ["A"] });
    expect(graph.getAncestors("F")).toEqual(result);
  });

  it("keeps indexes isolated between blueprints with reused node IDs", () => {
    const first = createDependencyGraph(dependencyFixture(["A", "B"], [["A", "B"]]));
    const second = createDependencyGraph(dependencyFixture(["A", "B"], []));
    expect(first.getAncestors("B").direct).toEqual(["A"]);
    expect(second.getAncestors("B").direct).toEqual([]);
  });

  it("handles a 12000-node chain without recursive stack overflow", () => {
    const names = Array.from({ length: 12000 }, (_, index) => String(index));
    const pairs = names.slice(1).map((name, index) => [names[index]!, name] as const);
    const graph = createDependencyGraph(dependencyFixture(names, pairs));
    const result = graph.getAncestors("11999");
    expect(result.direct).toEqual(["11998"]);
    expect(result.indirect).toHaveLength(11998);
    expect(result.indirect).not.toContain("11999");
  });

  it("matches an independent transitive-closure oracle for all 1024 forward-edge DAGs on five nodes", () => {
    const names = ["A", "B", "C", "D", "E"];
    const possible: [number, number][] = [];
    for (let from = 0; from < 5; from += 1)
      for (let to = from + 1; to < 5; to += 1) possible.push([from, to]);
    for (let mask = 0; mask < 2 ** possible.length; mask += 1) {
      const edges = possible.filter((_, bit) => (mask & (1 << bit)) !== 0);
      const reachable = names.map(() => names.map(() => false));
      for (const [from, to] of edges) reachable[from]![to] = true;
      // Matrix transitive closure is independent of the implementation's stack walk.
      for (let via = 0; via < 5; via += 1)
        for (let from = 0; from < 5; from += 1)
          for (let to = 0; to < 5; to += 1) {
            reachable[from]![to] ||= reachable[from]![via]! && reachable[via]![to]!;
          }
      const graph = createDependencyGraph(
        dependencyFixture(
          names,
          edges.map(([from, to]) => [names[from]!, names[to]!] as const),
        ),
      );
      names.forEach((target, to) => {
        const direct = edges.filter(([, end]) => end === to).map(([from]) => names[from]!);
        const indirect = names.filter(
          (name, from) => reachable[from]![to] && !direct.includes(name),
        );
        expect(graph.getAncestors(target)).toEqual({ direct, indirect });
      });
    }
  });
});

describe("dependency validation", () => {
  it.each([
    ["self-loop", ["A"], [["A", "A"]]],
    [
      "two-node cycle",
      ["A", "B"],
      [
        ["A", "B"],
        ["B", "A"],
      ],
    ],
    [
      "longer cycle",
      ["A", "B", "C"],
      [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
      ],
    ],
    [
      "disconnected cycle",
      ["root", "leaf", "A", "B"],
      [
        ["root", "leaf"],
        ["A", "B"],
        ["B", "A"],
      ],
    ],
  ] as const)("rejects a %s", (_label, nodes, edges) => {
    expect(() => createDependencyGraph(dependencyFixture(nodes, edges))).toThrow(
      "graph contains a cycle",
    );
  });

  it.each([
    ["missing", "A"],
    ["A", "missing"],
  ] as const)("rejects missing edge endpoint %s → %s", (source, target) => {
    expect(() => createDependencyGraph(dependencyFixture(["A"], [[source, target]]))).toThrow(
      "edge references a missing node",
    );
  });

  it("rejects duplicate node IDs", () => {
    expect(() => createDependencyGraph(dependencyFixture(["A", "A"], []))).toThrow(
      "duplicate node ID",
    );
  });

  it.each([{ prerequisites: [] }, { prerequisites: ["A", "C"] }, { prerequisites: ["C"] }])(
    "rejects disagreeing prerequisites $prerequisites",
    ({ prerequisites }) => {
      const fixture = dependencyFixture(["A", "B", "C"], [["A", "B"]]);
      expect(() =>
        createDependencyGraph({
          ...fixture,
          nodes: fixture.nodes.map((node) => ({
            ...node,
            prerequisites: node.id === "B" ? prerequisites : [],
          })),
        }),
      ).toThrow("edges and prerequisites disagree");
    },
  );

  it("rejects a missing prerequisite reference", () => {
    const fixture = dependencyFixture(["A"], []);
    expect(() =>
      createDependencyGraph({
        ...fixture,
        nodes: [{ id: "A", type: "form", prerequisites: ["missing"] }],
      }),
    ).toThrow("prerequisite references a missing node");
  });

  it("rejects a form projection referencing an absent node", () => {
    const fixture = dependencyFixture(["A"], []);
    expect(() => createDependencyGraph({ ...fixture, nodes: [] })).toThrow(
      "form references a missing node",
    );
  });

  it("rejects duplicate form projections", () => {
    const fixture = dependencyFixture(["A"], []);
    expect(() =>
      createDependencyGraph({ ...fixture, forms: [...fixture.forms, ...fixture.forms] }),
    ).toThrow("duplicate form node ID");
  });
});
