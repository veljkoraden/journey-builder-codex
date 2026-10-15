import type { Blueprint, FormInstance } from "../blueprint/model";

export interface DependencyGroups<T> {
  readonly direct: readonly T[];
  readonly indirect: readonly T[];
}

export interface DependencyGraph {
  getAncestors(nodeId: string): DependencyGroups<string>;
  getUpstreamForms(nodeId: string): DependencyGroups<FormInstance>;
}

export class DependencyValidationError extends Error {
  constructor(detail: string) {
    super(`Invalid blueprint dependencies: ${detail}. Check the server response and try again.`);
    this.name = "DependencyValidationError";
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

// One private adjacency index per loaded blueprint; no React or network dependencies.
export function createDependencyGraph(blueprint: Blueprint): DependencyGraph {
  const predecessors = new Map<string, Set<string>>();
  const successors = new Map<string, Set<string>>();
  for (const node of blueprint.nodes) {
    if (predecessors.has(node.id)) throw new DependencyValidationError("duplicate node ID");
    predecessors.set(node.id, new Set());
    successors.set(node.id, new Set());
  }
  for (const edge of blueprint.edges) {
    const incoming = predecessors.get(edge.target);
    const outgoing = successors.get(edge.source);
    if (!incoming || !outgoing)
      throw new DependencyValidationError("an edge references a missing node");
    // Duplicate edges represent the same relationship, not extra dependencies.
    incoming.add(edge.source);
    outgoing.add(edge.target);
  }
  for (const node of blueprint.nodes) {
    // null means metadata was absent; [] explicitly claims no prerequisites.
    if (node.prerequisites === null) continue;
    const declared = new Set(node.prerequisites);
    for (const id of declared) {
      if (!predecessors.has(id))
        throw new DependencyValidationError("a prerequisite references a missing node");
    }
    const actual = predecessors.get(node.id)!;
    if (declared.size !== actual.size || [...declared].some((id) => !actual.has(id))) {
      throw new DependencyValidationError("edges and prerequisites disagree");
    }
  }

  // Kahn's algorithm checks every component without recursive call-stack growth.
  const remaining = new Map([...predecessors].map(([id, parents]) => [id, parents.size]));
  const ready = [...remaining].filter(([, count]) => count === 0).map(([id]) => id);
  for (let cursor = 0; cursor < ready.length; cursor += 1) {
    for (const child of successors.get(ready[cursor]!)!) {
      const count = remaining.get(child)! - 1;
      remaining.set(child, count);
      if (count === 0) ready.push(child);
    }
  }
  if (ready.length !== predecessors.size) {
    throw new DependencyValidationError("the graph contains a cycle");
  }

  const forms = new Map<string, FormInstance>();
  for (const form of blueprint.forms) {
    if (!predecessors.has(form.nodeId))
      throw new DependencyValidationError("a form references a missing node");
    if (forms.has(form.nodeId)) throw new DependencyValidationError("duplicate form node ID");
    forms.set(form.nodeId, form);
  }

  function getAncestors(nodeId: string): DependencyGroups<string> {
    const parents = predecessors.get(nodeId);
    if (!parents) throw new DependencyValidationError("the requested node does not exist");
    const visited = new Set<string>();
    const pending = [...parents];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const parent of predecessors.get(id)!) {
        if (!visited.has(parent)) pending.push(parent);
      }
    }
    // A direct parent reachable along a longer path still belongs only to direct.
    return Object.freeze({
      direct: Object.freeze([...parents].sort(compareText)),
      indirect: Object.freeze([...visited].filter((id) => !parents.has(id)).sort(compareText)),
    });
  }

  function getUpstreamForms(nodeId: string): DependencyGroups<FormInstance> {
    const ancestors = getAncestors(nodeId);
    const selectForms = (ids: readonly string[]) =>
      Object.freeze(
        ids
          .flatMap((id) => {
            const form = forms.get(id);
            return form ? [form] : [];
          })
          .sort(
            (left, right) =>
              compareText(left.name, right.name) || compareText(left.nodeId, right.nodeId),
          ),
      );
    return Object.freeze({
      direct: selectForms(ancestors.direct),
      indirect: selectForms(ancestors.indirect),
    });
  }

  return Object.freeze({ getAncestors, getUpstreamForms });
}
