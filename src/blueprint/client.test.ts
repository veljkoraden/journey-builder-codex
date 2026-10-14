import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBlueprint } from "./client";

const endpoint = "http://localhost:3000/api/v1/1/actions/blueprints/test/graph";
afterEach(() => vi.unstubAllGlobals());

describe("blueprint HTTP client", () => {
  it("requests JSON and preserves the response without asserting an unvalidated schema", async () => {
    const payload = { nodes: [], additional: "preserved" };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();

    await expect(fetchBlueprint(endpoint, controller.signal)).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledWith(endpoint, {
      signal: controller.signal, headers: { Accept: "application/json" },
    });
  });

  it.each([400, 401, 404, 500, 503])("reports HTTP %s instead of treating error JSON as success", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private server details", { status })));
    await expect(fetchBlueprint(endpoint, new AbortController().signal)).rejects.toThrow(`HTTP ${status}`);
  });

  it.each(["", "<html>failure</html>", "{broken"])("reports malformed JSON %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(fetchBlueprint(endpoint, new AbortController().signal)).rejects.toThrow("unreadable JSON");
  });

  it("reports a network failure with a recovery instruction", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchBlueprint(endpoint, new AbortController().signal)).rejects.toThrow("Check that it is running");
  });

  it("does not issue a request when already aborted", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchBlueprint(endpoint, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
  });

  it("propagates cancellation during the request", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })));
    const controller = new AbortController();
    const result = fetchBlueprint(endpoint, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("preserves cancellation while reading the response body", async () => {
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => { started(); return new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      }); },
    }));
    const result = fetchBlueprint(endpoint, controller.signal);
    await reading;
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
