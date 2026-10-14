# Phase 7 — Isolated mapping state

## Outcome

The new mapping model can assign, replace, and clear a source reference for a target field. Changes are isolated by blueprint ID, form node ID, and field key. A React hook owns the reducer state for one mounted editor session. No mapping controls are connected to the visible application yet; that is Phase 8.

## Architecture and file structure

```text
src/mappings/
  model.ts                     target, state, and action types; target key encoding
  reducer.ts                   pure immutable updates and lookup
  usePrefillMappings.ts        React state owner and action callbacks
  reducer.test.ts              identity, isolation, immutability, edit sequences
  usePrefillMappings.test.tsx   React lifecycle and batched updates
```

### model.ts — describe the data

A `MappingTarget` contains `blueprintId`, `nodeId`, and `fieldKey`. Two form nodes can share a definition but must retain separate mappings, so definition IDs never identify a target. Display labels also do not identify targets.

`MappingState` is a readonly record indexed by an encoded target tuple. `mappingTargetKey` JSON-encodes the three strings, avoiding collisions when IDs contain colons, dots, quotes, Unicode, or prototype-like names. A field key is a literal string, not a dotted path.

Values reuse Phase 5's `SourceReference`: provider ID, resource ID, and field-path segments. The state stores references, not labels or submitted values. For example, Form D's email can refer to the indirect provider's Form A email field.

### reducer.ts — calculate the next state

A reducer is an ordinary function: `(previousState, action) => nextState`. It does not render HTML or fetch data.

- `createMappingState()` returns an empty frozen state.
- `mappingReducer(..., { type: "set", target, source })` adds a mapping or replaces the existing reference at that exact target. Replacement uses the same action because both operations assign one value atomically.
- `mappingReducer(..., { type: "clear", target })` removes only that target. Clearing an unmapped target returns the original state.
- `getMapping(state, target)` returns the reference or `undefined`.

Updates copy the record instead of changing the previous record. Unchanged references remain shared. Sources and their path arrays are copied and frozen before storage so later provider mutations cannot silently rewrite a saved mapping. Setting the same reference again returns the original state.

These choices make React state changes predictable and let tests inspect old snapshots safely. Copying the record costs O(number of mappings) per changed action; this is appropriate for the challenge's small editor. No state-management dependency is added.

### usePrefillMappings.ts — connect the reducer to React

`useReducer` holds state between renders. `setMapping` and `clearMapping` dispatch actions. React applies those actions to the latest state, so several updates in one event do not overwrite each other through stale closure values. `useCallback` gives future child components stable action functions.

The hook has no global singleton. Each mounted owner has separate state. Rerendering the same owner preserves edits; unmounting and mounting a new owner creates an empty session. There is no localStorage, sessionStorage, or backend write.

## What loads first and what changes in the app?

The existing application still starts through:

```text
index.html → src/main.tsx → App
  ├── BlueprintConnection → blueprint loader → form browser
  └── SourceConfigurationStatus → configuration hook → runtime JSON
```

**The new hook is not called by that render path yet.** This phase supplies tested behavior for the next phase's editor. The intended future flow is:

```text
Editor owner calls usePrefillMappings()
  → user confirms an option in a dialog
  → setMapping(target, option.reference)
  → reducer computes new state
  → React renders again
  → field row calls getMapping(state, target) to display its mapping
```

Mount the hook above the selected form/field view, so switching forms does not unmount the state owner. Each action carries the complete target; the reducer does not infer it from whichever field happens to be selected later.

Example for future UI integration:

```tsx
const { state, setMapping, clearMapping } = usePrefillMappings();
const target = { blueprintId: blueprint.id, nodeId: form.nodeId, fieldKey: field.key };
const mapping = getMapping(state, target);
// After confirmation and eligibility validation:
setMapping(target, selectedOption.reference);
// The clear button:
clearMapping(target);
```

This is an integration illustration, not a component added in Phase 7. Draft selections belong to the future dialog and must not dispatch until the user confirms. Cancel should dispatch nothing.

## Validation evidence

- `npm run test:run`: **252 tests passed across 15 files**, including **33 new tests**.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Reducer coverage includes assignment/replacement/clearing, unmapped no-ops, every target identity dimension, shared definitions, source namespaces and path changes, literal dotted paths, prototype-like keys, copied input data, frozen snapshots, unavailable-provider retention, and a deterministic 500-action sequence across 27 targets checked against an independent array reference model after every action.

React tests cover assignment/replacement/clearing, batched updates, changing selected form without losing edits, independent owners, reset on remount, and StrictMode. Existing source, configuration, graph, and UI suites also pass.

No new browser behavior is claimed: Phase 7 does not change the rendered UI. The production build includes the reviewed Phase 6 UI; the unused mapping modules are not connected to the app bundle yet.

## PR base and repository state

At implementation start, PRs #4 and #5 were marked merged, but #5 had merged into `feat/phase-05-sources` and its changes were not in `main`. The Phase 7 branch starts at `main` and incorporates that reviewed branch before the mapping-state commit. The new PR targets `main`, includes the already-reviewed Phase 6 changes, and identifies the Phase 7 commit separately. No main-branch merge is performed by this task.

## Remaining risks and deferrals

The reducer accepts typed references from application code; it is not an untrusted-data validator and does not query source eligibility. Phase 8 must validate selected targets/sources before committing; later lifecycle handling must prevent stale dialog actions. Disabled or failed providers do not erase existing mappings; unavailable-source presentation comes later. State is scoped only by the blueprint ID available in the current normalized model; future tenant/version switching may require additional scope or resetting the owner.

No backend mapping contract, persistence, undo history, automatic defaults, type coercion, or blueprint reconciliation is introduced. The state disappears when its owner unmounts or the page reloads. Large graphs may require a different state representation if measured update costs justify it.

## Next phase

Phase 8: connect mapping state, runtime configuration, and source catalogs to field rows and an accessible dialog. Add confirmed assignment, replacement, clearing, cancel/Escape behavior, focus handling, and target isolation interaction tests.
