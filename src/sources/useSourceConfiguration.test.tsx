import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSourceConfiguration } from "./useSourceConfiguration";

const response = (id = "global-properties") => new Response(JSON.stringify({ providers: [{ id, enabled: true }] }));
function deferred() {
  let resolve!: (r: Response) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
}
afterEach(() => vi.unstubAllGlobals());
it("loads and retries a failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response()));
  const { result } = renderHook(() => useSourceConfiguration());
  expect(result.current.state.status).toBe("loading");
  await waitFor(() => expect(result.current.state.status).toBe("error"));
  act(() => result.current.retry());
  expect(result.current.state.status).toBe("loading");
  await waitFor(() => expect(result.current.state).toMatchObject({ status: "success", selections: [{ id: "global-properties" }] }));
});
it.each(["resolve", "reject"])("ignores stale %s after changing URL", async (outcome) => {
  const old = deferred();
  const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response());
  vi.stubGlobal("fetch", fetcher);
  const { result, rerender } = renderHook(({ url }) => useSourceConfiguration(url), { initialProps: { url: "/old" } });
  rerender({ url: "/new" });
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
  await waitFor(() => expect(result.current.state.status).toBe("success"));
  await act(async () => { if (outcome === "resolve") old.resolve(response("direct-forms")); else old.reject(new Error("late")); });
  expect(result.current.state).toMatchObject({ status: "success", selections: [{ id: "global-properties" }] });
});
it("hides prior selections while reloading", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(new Promise(() => {})));
  const { result } = renderHook(() => useSourceConfiguration());
  await waitFor(() => expect(result.current.state.status).toBe("success"));
  act(() => result.current.retry());
  expect(result.current.state).toEqual({ status: "loading" });
});
it("aborts on unmount", () => {
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {})); vi.stubGlobal("fetch", fetcher);
  const { unmount } = renderHook(() => useSourceConfiguration());
  unmount();
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
});
it("survives StrictMode effect cleanup", async () => {
  const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useSourceConfiguration(), { wrapper: StrictMode });
  await waitFor(() => expect(result.current.state.status).toBe("success"));
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
});
