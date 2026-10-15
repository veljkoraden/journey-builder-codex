import type { ProviderResult, SourceContext, SourceGroup, SourceSelection } from "./model";
import { sourceReferenceKey } from "./model";
import type { SourceRegistry } from "./registry";

function validateGroups(providerId: string, groups: readonly SourceGroup[]): void {
  const groupIds = new Set<string>();
  const references = new Set<string>();
  for (const group of groups) {
    if (!group.id.trim() || groupIds.has(group.id))
      throw new Error("Duplicate or empty source group ID.");
    groupIds.add(group.id);
    for (const option of group.options) {
      const reference = option.reference;
      if (
        reference.providerId !== providerId ||
        !reference.resourceId.trim() ||
        reference.fieldPath.length === 0 ||
        reference.fieldPath.some((part) => typeof part !== "string")
      ) {
        throw new Error("Invalid source reference.");
      }
      const key = sourceReferenceKey(reference);
      if (references.has(key)) throw new Error("Duplicate source reference.");
      references.add(key);
    }
  }
}

// Race cancellation so even an uncooperative provider cannot keep the caller waiting.
function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) {
      signal.removeEventListener("abort", abort);
      abort();
    }
  });
}

export async function loadSourceCatalog(
  registry: SourceRegistry,
  selections: readonly SourceSelection[],
  context: SourceContext,
  signal: AbortSignal,
): Promise<readonly ProviderResult[]> {
  signal.throwIfAborted();
  // Resolve everything before starting any provider: invalid selection never partially runs.
  const resolved = registry.resolve(selections);
  const form = context.blueprint.forms.find(
    (candidate) => candidate.nodeId === context.targetForm.nodeId,
  );
  if (form !== context.targetForm || !form.fields.includes(context.targetField)) {
    throw new Error("Source target must belong to the loaded blueprint.");
  }
  return Promise.all(
    resolved.map(async ({ provider, settings }): Promise<ProviderResult> => {
      try {
        const groups = await abortable(
          Promise.resolve().then(() => {
            signal.throwIfAborted();
            return provider.getGroups(context, settings, signal);
          }),
          signal,
        );
        signal.throwIfAborted();
        validateGroups(provider.id, groups);
        return { providerId: provider.id, status: "success", groups };
      } catch (error) {
        signal.throwIfAborted();
        return {
          providerId: provider.id,
          status: "error",
          message: error instanceof Error ? error.message : "Source provider failed.",
        };
      }
    }),
  );
}
