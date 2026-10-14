import type { FormField } from "./model";

// Buttons trigger actions, while arrays and objects can still hold prefilled data.
export function isPrefillField(field: FormField): boolean {
  return field.controlType !== "button";
}
