import { afterEach, describe, expect, it, vi } from "vitest";
import { blueprintFixture } from "../test/blueprintFixture";
import { loadBlueprint } from "./loadBlueprint";

afterEach(() => vi.unstubAllGlobals());

describe("validated blueprint loading", () => {
  it("returns normalized data and a ready-to-query dependency index", async () => {
    const fixture = blueprintFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture))));
    const loaded = await loadBlueprint("/graph", new AbortController().signal);
    expect(loaded.data.forms.map((form) => form.nodeId)).toEqual(["node-a", "node-b", "node-c"]);
    expect(loaded.dependencies.getAncestors("node-b")).toEqual({
      direct: ["node-a"],
      indirect: [],
    });
    expect(loaded.dependencies.getUpstreamForms("node-b").direct[0]?.name).toBe("Form A");
  });

  it("rejects structurally valid data with invalid dependency semantics", async () => {
    const fixture = blueprintFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...fixture, edges: [] }))),
    );
    await expect(loadBlueprint("/graph", new AbortController().signal)).rejects.toThrow(
      "edges and prerequisites disagree",
    );
  });

  it("does not disguise structural errors as dependency errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(loadBlueprint("/graph", new AbortController().signal)).rejects.toThrow(
      "Invalid blueprint: id",
    );
  });

  it("does not start a request after cancellation", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();
    controller.abort();
    await expect(loadBlueprint("/graph", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(request).not.toHaveBeenCalled();
  });
});
