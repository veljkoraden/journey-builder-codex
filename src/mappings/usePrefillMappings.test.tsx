import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { getMapping } from "./reducer";
import { usePrefillMappings } from "./usePrefillMappings";

const target = { blueprintId: "blueprint", nodeId: "D", fieldKey: "email" };
const source = { providerId: "indirect-forms", resourceId: "A", fieldPath: ["email"] };

it("sets, replaces and clears through React", () => {
  const { result } = renderHook(() => usePrefillMappings());
  act(() => result.current.setMapping(target, source));
  expect(getMapping(result.current.state, target)).toEqual(source);
  const replacement = { ...source, resourceId: "B", providerId: "direct-forms" };
  act(() => result.current.setMapping(target, replacement));
  expect(getMapping(result.current.state, target)).toEqual(replacement);
  act(() => result.current.clearMapping(target));
  expect(getMapping(result.current.state, target)).toBeUndefined();
});
it("retains multiple updates batched in one event", () => {
  const { result } = renderHook(() => usePrefillMappings());
  const other = { ...target, nodeId: "E" };
  act(() => {
    result.current.setMapping(target, source);
    result.current.setMapping(other, { ...source, resourceId: "C" });
  });
  expect(getMapping(result.current.state, target)).toEqual(source);
  expect(getMapping(result.current.state, other)?.resourceId).toBe("C");
});
it("retains mappings when the owner rerenders with another selected form", () => {
  const { result, rerender } = renderHook(
    ({ nodeId }) => {
      const mappings = usePrefillMappings();
      return { ...mappings, selected: { ...target, nodeId } };
    },
    { initialProps: { nodeId: "D" } },
  );
  act(() => result.current.setMapping(result.current.selected, source));
  rerender({ nodeId: "E" });
  expect(getMapping(result.current.state, result.current.selected)).toBeUndefined();
  rerender({ nodeId: "D" });
  expect(getMapping(result.current.state, result.current.selected)).toEqual(source);
});
it("starts a fresh session after unmount and remount", () => {
  const first = renderHook(() => usePrefillMappings());
  act(() => first.result.current.setMapping(target, source));
  first.unmount();
  const second = renderHook(() => usePrefillMappings());
  expect(getMapping(second.result.current.state, target)).toBeUndefined();
});
it("keeps independently mounted editors isolated", () => {
  const first = renderHook(() => usePrefillMappings());
  const second = renderHook(() => usePrefillMappings());
  act(() => first.result.current.setMapping(target, source));
  expect(getMapping(second.result.current.state, target)).toBeUndefined();
});
it("is safe under StrictMode's repeated reducer calls", () => {
  const { result } = renderHook(() => usePrefillMappings(), { wrapper: StrictMode });
  act(() => {
    result.current.setMapping(target, source);
    result.current.setMapping({ ...target, fieldKey: "name" }, source);
    result.current.clearMapping(target);
  });
  expect(getMapping(result.current.state, target)).toBeUndefined();
  expect(getMapping(result.current.state, { ...target, fieldKey: "name" })).toEqual(source);
});
