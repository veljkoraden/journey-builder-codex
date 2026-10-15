import type { Blueprint } from "../blueprint/model";

// Independent graph fixture: null prerequisites let tests specify edges directly.
export function dependencyFixture(
  ids: readonly string[] = ["A", "B", "C", "D", "E", "F"],
  pairs: readonly (readonly [string, string])[] = [
    ["A", "B"],
    ["A", "C"],
    ["B", "D"],
    ["C", "E"],
    ["D", "F"],
    ["E", "F"],
  ],
): Blueprint {
  return {
    id: "dependencies",
    name: "Dependencies",
    nodes: ids.map((id) => ({ id, type: "form", prerequisites: null })),
    edges: pairs.map(([source, target]) => ({ source, target })),
    forms: ids.map((nodeId) => ({
      nodeId,
      definitionId: "shared",
      name: `Form ${nodeId}`,
      fields: [],
    })),
  };
}
