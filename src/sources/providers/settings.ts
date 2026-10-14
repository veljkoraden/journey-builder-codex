// Built-in catalogs have no configurable settings yet; do not silently ignore input.
export function rejectSettings(settings: unknown): void {
  if (settings !== undefined) throw new Error("This provider does not accept settings.");
}
