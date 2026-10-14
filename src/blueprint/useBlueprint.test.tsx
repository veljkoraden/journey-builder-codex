import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBlueprint } from "./useBlueprint";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

afterEach(() => vi.unstubAllGlobals());

describe("blueprint request lifecycle", () => {
  it("stays idle without a configured endpoint", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const { result } = renderHook(() => useBlueprint(null));
    expect(result.current.state.status).toBe("idle");
    expect(request).not.toHaveBeenCalled();
  });

  it("moves from loading to success", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { result } = renderHook(() => useBlueprint("/graph"));
    expect(result.current.state.status).toBe("loading");
    await act(async () => pending.resolve(new Response('{"id":"one"}')));
    expect(result.current.state).toEqual({ status: "success", data: { id: "one" } });
  });

  it("recovers from an error through retry", async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", request);
    const { result } = renderHook(() => useBlueprint("/graph"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)("ignores a stale %s after switching endpoints", async (outcome) => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    vi.stubGlobal("fetch", request);
    const { result, rerender } = renderHook(({ url }) => useBlueprint(url), { initialProps: { url: "/old" } });
    const oldSignal = request.mock.calls[0]?.[1].signal as AbortSignal;
    rerender({ url: "/new" });
    expect(oldSignal.aborted).toBe(true);
    await act(async () => current.resolve(new Response('{"id":"new"}')));
    await act(async () => {
      if (outcome === "resolve") old.resolve(new Response('{"id":"old"}'));
      else old.reject(new TypeError("late error"));
    });
    expect(result.current.state).toEqual({ status: "success", data: { id: "new" } });
  });

  it("clears a previous success immediately when configuration becomes unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const { result, rerender } = renderHook(({ url }: { url: string | null }) => useBlueprint(url), {
      initialProps: { url: "/graph" as string | null },
    });
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    rerender({ url: null });
    expect(result.current.state.status).toBe("idle");
  });

  it("aborts pending work on unmount and tolerates a late rejection", async () => {
    const pending = deferred<Response>();
    const request = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", request);
    const { unmount } = renderHook(() => useBlueprint("/graph"));
    const signal = request.mock.calls[0]?.[1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.reject(new DOMException("Aborted", "AbortError")));
  });

  it("survives StrictMode cleanup without displaying the cancelled request as an error", async () => {
    const pending = deferred<Response>();
    const request = vi.fn().mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response('{"id":"current"}'));
    vi.stubGlobal("fetch", request);
    const { result } = renderHook(() => useBlueprint("/graph"), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect((request.mock.calls[0]?.[1].signal as AbortSignal).aborted).toBe(true);
    await act(async () => pending.reject(new DOMException("Aborted", "AbortError")));
    expect(result.current.state).toEqual({ status: "success", data: { id: "current" } });
  });
});
