import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadSourceConfiguration,
  parseSourceConfiguration,
  sourceConfigurationUrl,
} from "./configuration";
import { createSourceRegistry, sourceRegistry } from "./registry";
import { loadSourceCatalog } from "./loadSourceCatalog";
import { dependencyFixture } from "../test/dependencyFixture";
import { createDependencyGraph } from "../dependencies/createDependencyGraph";
import shipped from "../../public/source-config.json";

const ids = ["direct-forms", "indirect-forms", "global-properties"];
const config = (mask = 7) => ({
  providers: ids.map((id, i) => ({ id, enabled: !!(mask & (1 << i)) })),
});
afterEach(() => vi.unstubAllGlobals());

describe("runtime configuration validation", () => {
  it("ships valid configuration without prescribing an enabled subset", () => {
    expect(() => parseSourceConfiguration(shipped)).not.toThrow();
  });
  it.each(Array.from({ length: 8 }, (_, i) => i))(
    "controls catalog results for subset %i",
    async (mask) => {
      const original = dependencyFixture();
      const field = {
        key: "email",
        label: "Email",
        types: ["string"],
        controlType: null,
        required: false,
      };
      const blueprint = {
        ...original,
        forms: original.forms.map((form) => ({ ...form, fields: [field] })),
      };
      const selections = parseSourceConfiguration(config(mask));
      const catalog = await loadSourceCatalog(
        sourceRegistry,
        selections,
        {
          blueprint,
          dependencies: createDependencyGraph(blueprint),
          targetForm: blueprint.forms.find((f) => f.nodeId === "D")!,
          targetField: field,
        },
        new AbortController().signal,
      );
      expect(catalog.map((r) => r.providerId)).toEqual(ids.filter((_, i) => mask & (1 << i)));
      const expected = [["B"], ["A"], ["sample-organization"]].filter((_, i) => mask & (1 << i));
      expect(catalog.map((r) => r.status === "success" && r.groups.map((g) => g.id))).toEqual(
        expected,
      );
    },
  );
  it("allows an empty list and preserves configuration order", () => {
    expect(parseSourceConfiguration({ providers: [] })).toEqual([]);
    expect(
      parseSourceConfiguration({ providers: [...config().providers].reverse() }).map((s) => s.id),
    ).toEqual([...ids].reverse());
  });
  it.each([
    null,
    [],
    {},
    { providers: null },
    { providers: {} },
    { providers: [], typo: true },
    { providers: [null] },
    { providers: [{ id: "direct-forms" }] },
    { providers: [{ id: "direct-forms", enabled: "true" }] },
    { providers: [{ id: "", enabled: true }] },
    { providers: [{ id: 1, enabled: true }] },
    { providers: [{ id: "global-properties", enabled: true, typo: true }] },
    { providers: [{ id: "missing", enabled: false }] },
    {
      providers: [
        { id: "direct-forms", enabled: true },
        { id: "direct-forms", enabled: false },
      ],
    },
    { providers: [{ id: "global-properties", enabled: false, settings: {} }] },
  ])("rejects malformed configuration %# without defaults", (value) => {
    expect(() => parseSourceConfiguration(value)).toThrow("Invalid source configuration");
  });
  it("supports registered providers with their own settings validator", () => {
    const validateSettings = vi.fn((value: unknown) => {
      if (value !== "valid") throw new Error("Expected valid");
    });
    const registry = createSourceRegistry([
      { id: "extra", validateSettings, getGroups: async () => [] },
    ]);
    const value = { providers: [{ id: "extra", enabled: true, settings: "valid" }] };
    expect(parseSourceConfiguration(value, registry)).toEqual([{ id: "extra", settings: "valid" }]);
    expect(validateSettings).toHaveBeenCalledWith("valid");
    expect(() =>
      parseSourceConfiguration(
        { providers: [{ id: "extra", enabled: false, settings: "invalid" }] },
        registry,
      ),
    ).toThrow("Expected valid");
  });
  it("rejects settings when a custom provider has no validator", () => {
    const registry = createSourceRegistry([{ id: "extra", getGroups: async () => [] }]);
    expect(() =>
      parseSourceConfiguration(
        { providers: [{ id: "extra", enabled: true, settings: {} }] },
        registry,
      ),
    ).toThrow("does not declare settings support");
  });
});

describe("configuration HTTP boundary", () => {
  it.each([
    ["/", "/source-config.json"],
    ["/journey/", "/journey/source-config.json"],
    ["/journey", "/journey/source-config.json"],
  ])("supports base %s", (base, expected) => {
    expect(sourceConfigurationUrl(base)).toBe(expected);
  });
  it("fetches fresh configuration with cancellation and honors file changes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(config(7))))
      .mockResolvedValueOnce(new Response(JSON.stringify(config(4))));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(
      await loadSourceConfiguration(signal, sourceRegistry, "/journey/source-config.json"),
    ).toHaveLength(3);
    expect(
      await loadSourceConfiguration(signal, sourceRegistry, "/journey/source-config.json"),
    ).toEqual([{ id: "global-properties", settings: undefined }]);
    expect(fetcher).toHaveBeenCalledWith("/journey/source-config.json", {
      signal,
      cache: "no-store",
    });
  });
  it.each([404, 503])("reports HTTP %i without fallback", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status })));
    await expect(loadSourceConfiguration(new AbortController().signal)).rejects.toThrow(
      `HTTP ${status}`,
    );
  });
  it("reports invalid JSON including an HTML SPA fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>app</html>")));
    await expect(loadSourceConfiguration(new AbortController().signal)).rejects.toThrow(
      "not valid JSON",
    );
  });
  it("reports connection failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(loadSourceConfiguration(new AbortController().signal)).rejects.toThrow(
      "Check the connection",
    );
  });
  it("does not fetch when already aborted", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(loadSourceConfiguration(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves cancellation if fetch ignores abort", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        controller.abort();
        return new Response(JSON.stringify(config()));
      }),
    );
    await expect(loadSourceConfiguration(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
