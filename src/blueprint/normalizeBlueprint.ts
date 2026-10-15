import type { Blueprint, FormField, FormInstance } from "./model";

export class BlueprintValidationError extends Error {
  constructor(detail: string) {
    super(`Invalid blueprint: ${detail}. Check the server response and try again.`);
    this.name = "BlueprintValidationError";
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BlueprintValidationError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new BlueprintValidationError(`${path} must be an array`);
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BlueprintValidationError(`${path} must be a nonempty string`);
  }
  return value;
}

function label(value: unknown, fallback: string, path: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new BlueprintValidationError(`${path} must be a string`);
  return value.trim() || fallback;
}

function unique(id: string, seen: Set<string>, path: string) {
  if (seen.has(id)) throw new BlueprintValidationError(`${path} contains a duplicate ID`);
  seen.add(id);
}

function fields(value: unknown, path: string): FormField[] {
  const schema = record(value, path);
  const properties = record(schema.properties, `${path}.properties`);
  const required = new Set(
    schema.required === undefined
      ? []
      : list(schema.required, `${path}.required`).map((key) => text(key, `${path}.required entry`)),
  );
  return Object.entries(properties).map(([key, value]) => {
    const propertyPath = `${path}.properties[${JSON.stringify(key)}]`;
    const property = record(value, propertyPath);
    const types =
      property.type === undefined
        ? []
        : typeof property.type === "string"
          ? [property.type]
          : list(property.type, `${propertyPath}.type`).map((type) =>
              text(type, `${propertyPath}.type entry`),
            );
    if (
      property.type !== undefined &&
      (!types.length ||
        types.some(
          (type) =>
            !["string", "number", "integer", "boolean", "object", "array", "null"].includes(type),
        ))
    ) {
      throw new BlueprintValidationError(`${propertyPath}.type is unsupported`);
    }
    return {
      key,
      label: label(property.title, key, `${propertyPath}.title`),
      types,
      controlType:
        property.avantos_type === undefined
          ? null
          : text(property.avantos_type, `${propertyPath}.avantos_type`),
      required: required.has(key),
    };
  });
}

// Validate the response shape; loadBlueprint checks dependency semantics afterward.
export function normalizeBlueprint(value: unknown): Blueprint {
  const root = record(value, "response");
  const id = text(root.id, "id");
  const definitionIds = new Set<string>();
  const definitions = new Map<string, readonly FormField[]>();
  list(root.forms, "forms").forEach((value, index) => {
    const path = `forms[${index}]`;
    const definition = record(value, path);
    const definitionId = text(definition.id, `${path}.id`);
    unique(definitionId, definitionIds, "forms");
    definitions.set(definitionId, fields(definition.field_schema, `${path}.field_schema`));
  });

  const nodeIds = new Set<string>();
  const forms: FormInstance[] = [];
  const nodes = list(root.nodes, "nodes").map((value, index) => {
    const path = `nodes[${index}]`;
    const node = record(value, path);
    const nodeId = text(node.id, `${path}.id`);
    unique(nodeId, nodeIds, "nodes");
    const type = text(node.type, `${path}.type`);
    const data =
      node.data === undefined && type !== "form" ? {} : record(node.data, `${path}.data`);
    const prerequisites =
      data.prerequisites === undefined
        ? null
        : list(data.prerequisites, `${path}.data.prerequisites`).map((entry) =>
            text(entry, `${path}.data.prerequisites entry`),
          );
    if (type === "form") {
      const definitionId = text(data.component_id, `${path}.data.component_id`);
      const definitionFields = definitions.get(definitionId);
      if (!definitionFields)
        throw new BlueprintValidationError(`${path} references a missing form definition`);
      forms.push({
        nodeId,
        definitionId,
        name: text(data.name, `${path}.data.name`),
        fields: definitionFields,
      });
    }
    return { id: nodeId, type, prerequisites };
  });

  const edges = list(root.edges, "edges").map((value, index) => {
    const edge = record(value, `edges[${index}]`);
    return {
      source: text(edge.source, `edges[${index}].source`),
      target: text(edge.target, `edges[${index}].target`),
    };
  });
  return { id, name: label(root.name, id, "name"), forms, nodes, edges };
}
