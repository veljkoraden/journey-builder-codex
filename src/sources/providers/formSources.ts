import type { SourceProvider } from "../model";

import { rejectSettings } from "./settings";

function formProvider(id: string, scope: "direct" | "indirect"): SourceProvider {
  return {
    id,
    validateSettings: rejectSettings,
    async getGroups(context, settings, signal) {
      signal.throwIfAborted();
      rejectSettings(settings);
      return context.dependencies
        .getUpstreamForms(context.targetForm.nodeId)
        [scope].filter((form) => form.fields.length > 0)
        .map((form) => ({
          id: form.nodeId,
          label: form.name,
          description: scope === "direct" ? "Direct" : "Transitive",
          // Source fields include button outputs; target eligibility is a separate policy.
          options: form.fields.map((field) => ({
            reference: { providerId: id, resourceId: form.nodeId, fieldPath: [field.key] },
            label: field.label,
            types: [...field.types],
          })),
        }));
    },
  };
}

export const directForms = formProvider("direct-forms", "direct");
export const indirectForms = formProvider("indirect-forms", "indirect");
