import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dependencyFixture } from "../test/dependencyFixture";
import { createDependencyGraph } from "../dependencies/createDependencyGraph";
import type { SourceContext, SourceGroup } from "./model";
import { createSourceRegistry } from "./registry";
import { useSourceCatalog } from "./useSourceCatalog";

function context(nodeId = "D"): SourceContext {
  const fixture = dependencyFixture();
  const field = {
    key: "email",
    label: "Email",
    types: ["string"],
    controlType: null,
    required: false,
  };
  const blueprint = {
    ...fixture,
    forms: fixture.forms.map((form) => ({ ...form, fields: [field] })),
  };
  return {
    blueprint,
    dependencies: createDependencyGraph(blueprint),
    targetForm: blueprint.forms.find((form) => form.nodeId === nodeId)!,
    targetField: field,
  };
}
const selections = [{ id: "remote" }];
const group = (label: string): SourceGroup => ({ id: "group", label, options: [] });

describe("catalog request ownership", () => {
  it.each(["resolve", "reject"])("ignores late %s from the previous target", async (outcome) => {
    let finish!: (groups: readonly SourceGroup[]) => void;
    let fail!: (error: unknown) => void;
    let oldSignal!: AbortSignal;
    let calls = 0;
    const registry = createSourceRegistry([
      {
        id: "remote",
        getGroups: async (_context, _settings, signal) => {
          calls += 1;
          if (calls > 1) return [group("Current")];
          oldSignal = signal;
          return new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          });
        },
      },
    ]);
    const { result, rerender } = renderHook(
      ({ target }) => useSourceCatalog(target, selections, registry),
      { initialProps: { target: context() } },
    );
    await waitFor(() => expect(calls).toBe(1));
    rerender({ target: context("E") });
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    await act(async () => {
      if (outcome === "resolve") finish([group("Stale")]);
      else fail(new Error("late"));
    });
    expect(result.current.state).toMatchObject({
      status: "success",
      results: [{ groups: [{ label: "Current" }] }],
    });
  });
  it("invalidates successful options immediately during retry and ignores stale retry results", async () => {
    let calls = 0;
    let finish!: (groups: readonly SourceGroup[]) => void;
    const registry = createSourceRegistry([
      {
        id: "remote",
        getGroups: async () => {
          calls += 1;
          if (calls === 2)
            return new Promise((resolve) => {
              finish = resolve;
            });
          return [group(calls === 1 ? "Initial" : "Latest")];
        },
      },
    ]);
    const target = context();
    const { result } = renderHook(() => useSourceCatalog(target, selections, registry));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    act(() => result.current.retry());
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(calls).toBe(2));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    await act(async () => finish([group("Stale")]));
    expect(result.current.state).toMatchObject({ results: [{ groups: [{ label: "Latest" }] }] });
  });
  it("does not invoke providers while inactive and cancels on becoming inactive", async () => {
    let calls = 0;
    let signal!: AbortSignal;
    const registry = createSourceRegistry([
      {
        id: "remote",
        getGroups: async (_ctx, _settings, currentSignal) => {
          calls += 1;
          signal = currentSignal;
          return new Promise(() => {});
        },
      },
    ]);
    const { result, rerender } = renderHook(
      ({ target }: { target: SourceContext | null }) =>
        useSourceCatalog(target, selections, registry),
      { initialProps: { target: null as SourceContext | null } },
    );
    expect(result.current.state.status).toBe("idle");
    expect(calls).toBe(0);
    rerender({ target: context() });
    await waitFor(() => expect(calls).toBe(1));
    rerender({ target: null });
    expect(result.current.state.status).toBe("idle");
    expect(signal.aborted).toBe(true);
  });
});
