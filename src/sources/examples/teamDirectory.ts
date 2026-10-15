import type { SourceProvider } from "../model";

interface TeamSettings { teamId: string; teamLabel: string }

function readSettings(value: unknown): TeamSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || Object.keys(value).some((key) => !["teamId", "teamLabel"].includes(key))
    || !("teamId" in value) || typeof value.teamId !== "string" || !value.teamId.trim() || value.teamId !== value.teamId.trim()
    || !("teamLabel" in value) || typeof value.teamLabel !== "string" || !value.teamLabel.trim()) {
    throw new Error("team-directory settings require teamId and teamLabel; no other keys are supported.");
  }
  return { teamId: value.teamId, teamLabel: value.teamLabel.trim() };
}

// Executable extension example; intentionally not registered in the default app.
// These are references to a sample catalog, not fetched or evaluated team values.
export const teamDirectory: SourceProvider = {
  id: "team-directory",
  validateSettings(settings) { readSettings(settings); },
  async getGroups(_context, settings, signal) {
    signal.throwIfAborted();
    const { teamId, teamLabel } = readSettings(settings);
    return [{
      id: teamId,
      label: teamLabel,
      description: "Team directory",
      options: [
        { key: "manager_email", label: "Manager email" },
        { key: "name", label: "Team name" },
      ].map(({ key, label }) => ({
        label,
        types: ["string"],
        reference: { providerId: "team-directory", resourceId: teamId, fieldPath: [key] },
      })),
    }];
  },
};
