import type { SourceSelection } from "./model";
import { sourceRegistry } from "./registry";
import type { SourceRegistry } from "./registry";

function fail(detail: string): never {
  throw new Error(`Invalid source configuration: ${detail}. Update source-config.json and retry.`);
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSourceConfiguration(
  value: unknown,
  registry: SourceRegistry = sourceRegistry,
): readonly SourceSelection[] {
  if (
    !object(value) ||
    Object.keys(value).some((key) => key !== "providers") ||
    !Array.isArray(value.providers)
  ) {
    return fail("expected an object containing a providers array");
  }
  const enabled: SourceSelection[] = [];
  const all: SourceSelection[] = [];
  for (const entry of value.providers) {
    if (
      !object(entry) ||
      Object.keys(entry).some((key) => !["id", "enabled", "settings"].includes(key)) ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      typeof entry.enabled !== "boolean"
    ) {
      return fail("each provider needs a nonempty id and a boolean enabled flag");
    }
    const selection = { id: entry.id, settings: entry.settings };
    all.push(selection);
    if (entry.enabled) enabled.push(selection);
  }
  try {
    // Check disabled entries too, so a typo cannot remain hidden until activation.
    for (const { provider, settings } of registry.resolve(all)) {
      if (provider.validateSettings) provider.validateSettings(settings);
      else if (settings !== undefined)
        throw new Error(`Provider ${provider.id} does not declare settings support`);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "provider validation failed");
  }
  return enabled;
}

export function sourceConfigurationUrl(baseUrl: string): string {
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}source-config.json`;
}

export async function loadSourceConfiguration(
  signal: AbortSignal,
  registry: SourceRegistry = sourceRegistry,
  url = sourceConfigurationUrl(import.meta.env.BASE_URL),
): Promise<readonly SourceSelection[]> {
  signal.throwIfAborted();
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: "no-store" });
  } catch {
    signal.throwIfAborted();
    throw new Error("Unable to load source-config.json. Check the connection and retry.");
  }
  signal.throwIfAborted();
  if (!response.ok)
    throw new Error(
      `Unable to load source-config.json (HTTP ${response.status}). Check the deployed file and retry.`,
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    signal.throwIfAborted();
    throw new Error("source-config.json is not valid JSON. Update the file and retry.");
  }
  signal.throwIfAborted();
  return parseSourceConfiguration(value, registry);
}
