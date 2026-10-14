import type { SourceProvider } from "../model";
import { rejectSettings } from "./settings";

export const globalProperties: SourceProvider = {
  id: "global-properties",
  async getGroups(_context, settings, signal) {
    signal.throwIfAborted();
    rejectSettings(settings);
    return [{
      id: "sample-organization",
      label: "Sample organization",
      options: [
        { key: "name", label: "Organization name" },
        { key: "support_email", label: "Support email" },
      ].map(({ key, label }) => ({
        reference: { providerId: "global-properties", resourceId: "sample-organization", fieldPath: [key] },
        label,
        types: ["string"],
      })),
    }];
  },
};
