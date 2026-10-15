// Independently authored: two instances reuse one definition; a third has other fields.
export function blueprintFixture() {
  return {
    id: "blueprint-test",
    name: "Customer onboarding",
    nodes: [
      {
        id: "node-a",
        type: "form",
        data: { component_id: "shared", name: "Form A", prerequisites: [] },
      },
      {
        id: "node-b",
        type: "form",
        data: { component_id: "shared", name: "Form B", prerequisites: ["node-a"] },
      },
      {
        id: "node-c",
        type: "form",
        data: { component_id: "other", name: "Form C", prerequisites: ["node-a"] },
      },
    ],
    edges: [
      { source: "node-a", target: "node-b" },
      { source: "node-a", target: "node-c" },
    ],
    forms: [
      {
        id: "shared",
        field_schema: {
          properties: {
            email: { title: "Email address", type: "string", avantos_type: "short-text" },
            preferences: { type: "array", items: { type: "string" } },
            profile: { title: "Profile", type: "object" },
            submit: { title: "Submit", type: "object", avantos_type: "button" },
          },
          required: ["email"],
        },
      },
      { id: "other", field_schema: { properties: { age: { title: "Age", type: "integer" } } } },
    ],
  };
}
