# Optimization O2 — Shared catalog, search, and availability decisions

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Delivery: an additional commit on the existing O1 PR #18, as requested.
O1 established readable component handlers and tooling; O2 removes repeated
catalog decisions from those components. O3 component/context restructuring is
not included.

## What changed and why

`src/sources/catalog.ts` is a small framework-independent module. It selects
successful provider groups, finds options using their complete stable identity,
formats source labels, normalizes search, and filters group/option labels.
Both the dialog and mapping availability use these shared decisions.

The dialog resolves its selected draft against the full current catalog. Filtering
a selected option out of view does not clear or invalidate that draft. Search
results and no-match feedback use the same filtered groups, eliminating separate
matching implementations in the dialog and group component.

Filtering deliberately retains groups with no matching options. React still
renders their keyed `SourceGroupChoices` components, which return null until they
have options again. This preserves expansion state while a group is temporarily
hidden by search. Removing those components from the array would lose that state.
The group component now receives filtered options and an `isSearching` flag; it
only renders choices and manages expansion.

`src/mappings/availability.ts` returns an explicit result:

- `unmapped`: no saved source to check;
- `checking`: the enabled source catalog is not resolved yet;
- `available`: the saved reference exists, with its current display label;
- `unavailable`: configuration is unknown, the provider is disabled, loading
  failed, or the reference is no longer offered.

Configuration/disabled states take precedence over old catalog results. A failure
from another provider does not make a healthy reference unavailable. The actual
mapping controls still request only their saved source's provider. Missing and
failed references remain stored; only a load failure offers a retry action.

The catalog request-state type moves from its hook to `sources/model.ts`, allowing
pure decision code to use it without depending on React. Idle and loading are
separate union members so TypeScript can narrow subsequent success/error cases.
No requests, effects, source settings, identities, or provider interfaces change.

## Files and architecture

```text
src/sources/
  model.ts                    shared provider/reference/request-state contracts
  catalog.ts                  pure catalog lookup, labels, and search
  catalog.test.ts             catalog identity/filtering regression tests
  useSourceCatalog.ts         unchanged request lifecycle, imports shared state type
src/mappings/
  availability.ts             pure saved-reference availability decisions
  availability.test.ts        precedence, failures, identity, and labels
src/ui/
  SourceDialog.tsx            calls catalog helpers and owns search/draft state
  SourceGroupChoices.tsx      renders already-filtered options; owns expansion
  MappingControls.tsx         renders availability and preserves clear/retry actions
  PrefillEditor.test.tsx      adds hidden-group expansion regression
```

Helpers take input and return output. They do not fetch, modify mappings, call
React Hooks, or know built-in provider IDs. New providers continue implementing
the existing contract and registering once. All eight combinations of installed
sources remain selectable through runtime JSON without rebuilding JavaScript.

## React walkthrough: what runs first?

```text
index.html → src/main.tsx → App
  ├── useSourceConfiguration → configuration loader → JSON + registry
  └── BlueprintConnection → useBlueprint → loadBlueprint
      → client → normalization + dependency validation → PrefillEditor
        ├── FormBrowser → FormFields → MappingControls
        │   → useSourceCatalog → getMappingAvailability → catalog lookup/label
        └── SourceDialog
            → useSourceCatalog → loadSourceCatalog → registered providers
            → catalog helpers → SourceGroupChoices
```

The HTML starts `main.tsx`, which mounts `App`. Effects load configuration and the
graph; state changes cause React to render again. Opening a field mounts the
dialog. Its catalog hook requests provider options and updates its request state.
React then calls the pure helpers during rendering to calculate what to display.

Typing updates the dialog's query state. Filtering produces the options shown by
`SourceGroupChoices`; it does not change saved mapping state. Choosing an option
updates the draft key. Confirming sends the original source reference and shared
display label to the editor, which updates the reducer and closes the dialog.

Mapping controls perform their own existing availability request. The new pure
helper converts that result into an explicit UI decision. For example, a disabled
provider produces `unavailable` with reason `disabled`; the component displays the
message and preserves the saved reference. No new global store or effect is added.

## Validation evidence

Validated on 2026-10-15:

- `npm run test:run`: 345 tests across 21 files passed (26 new tests over O1).
- `npm run lint` and `npm run format:check`: passed.
- `npm run build`: strict TypeScript and production build passed.
- `npm run test:e2e`: application/harness typechecks and all 16 Chromium scenarios
  passed against the pinned official mock over real HTTP, including all eight
  runtime source combinations without changing JavaScript assets.
- 63 relative documentation links resolve; `git diff --check` passed.

New coverage includes namespace and path identity, absent/stale selection,
case-insensitive group/field search, empty groups, hidden draft preservation,
nonmutating filtering, availability precedence, current labels, isolated failures,
and restoration of collapsed groups after search hides them. Existing mapping,
configuration, cancellation, accessibility, and additional-provider tests remain.
Local validation is separate from PR CI; check PR #18 for its latest head result.

## Remaining risks and next phase

This is not a caching or batching change. Repeated per-field catalog requests and
the all-form context map remain for later evaluation. Label snapshots still live
separately from mappings. Native dialog behavior, session-only state, and
Chromium-only automation remain unchanged.

O3 will simplify selected-form composition and context ownership while preserving
canonical form/field objects, stable inputs, mapping isolation, and keyboard focus.
PR #18 now contains O1 and O2; neither phase is automatically merged or deployed.
