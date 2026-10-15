import { describe, expect, it } from "vitest";
import { isPrefillField } from "./fieldPolicy";

describe("prefill target field policy", () => {
  it.each(["string", "array", "object", "number", "integer", "boolean", "null"])(
    "keeps %s fields",
    (type) => {
      expect(
        isPrefillField({
          key: "field",
          label: "Field",
          types: [type],
          required: false,
          controlType: null,
        }),
      ).toBe(true);
    },
  );
  it("excludes button controls even when their value schema is an object", () => {
    expect(
      isPrefillField({
        key: "submit",
        label: "Submit",
        types: ["object"],
        required: false,
        controlType: "button",
      }),
    ).toBe(false);
  });
});
