# Optimization O3 — Editor composition and context ownership

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Delivery: an additional commit on existing PR #18, following O1 and O2.

## What changed and why

`PrefillEditor` still owns saved mappings, fallback labels, per-form editing
settings, and the active dialog target. This state must survive switching forms.
It now delegates selected-form presentation to `PrefillForm`, instead of nesting
settings markup and field mapping logic inside its browsing callback.

`PrefillSettings` displays counts and the controlled editing switch. It receives
values and an `onChange` callback; it does not keep a second copy of those values.
`PrefillForm` composes the existing `FormFields` header and control slots. Its
private `PrefillFieldControls` reads each field's mapping and connects the generic
`MappingControls` component to the editor's callbacks.

The eager map of contexts for every field of every form is removed. Each mounted
field memoizes its own context; the editor separately memoizes the open dialog's
context. Both use the original normalized form and field objects. Dependencies
include the blueprint, dependency graph, form, and field, so a real input change
creates fresh inputs while unrelated renders do not restart catalog requests.
Unmapped controls still make no availability request. This is not shared caching:
a confirmed mapping still triggers its existing availability check.

`MappingControls` now focuses its explicit button ref after clearing. When source
configuration is unavailable and the button is disabled, it focuses the form
region through a ref passed from `PrefillForm` via `FormFields`. Focus no longer
depends on the clear button's previous sibling or a CSS ancestor selector.

## Files and responsibilities

```text
src/ui/PrefillEditor.tsx    durable state, mapping events, active dialog/context
src/ui/PrefillForm.tsx      selected form composition and per-field contexts
src/ui/PrefillSettings.tsx  count and controlled editing switch
src/ui/FormFields.tsx      reusable field layout, header/control slots, region ref
src/ui/MappingControls.tsx availability, mapping buttons, explicit focus refs
src/ui/PrefillEditor.test.tsx provider-input and interaction regression coverage
```

There is no provider-specific logic in these components. Installed source
combinations still change through served runtime JSON without rebuilding.
Implementing a genuinely new source still requires implementing and registering
a provider once; see [the extension guide](provider-extension.md).

## Learning React: what loads and renders first?

```text
index.html → src/main.tsx → App
  ├── useSourceConfiguration → runtime JSON + provider registry
  └── BlueprintConnection → useBlueprint → loadBlueprint
      → client + normalization + dependency validation
      → PrefillEditor
          ├── FormBrowser → FormList
          │   └── PrefillForm → FormFields
          │       ├── PrefillSettings (header slot)
          │       └── PrefillFieldControls → MappingControls → useSourceCatalog
          └── SourceDialog → useSourceCatalog → registered providers
              └── SourceGroupChoices
```

The HTML loads `main.tsx`, which mounts `App` with React's `createRoot` and
`StrictMode`. Loading hooks fetch configuration and graph data. When they update
state, React renders the resulting editor.

`FormBrowser` owns which form is selected. It calls the editor's `renderFields`
function with that form. The returned `PrefillForm` supplies a header component
and a function for rendering field controls to `FormFields`. These slots keep
the field layout reusable without moving mapping behavior into it.

Clicking a mapping button calls `onOpen(field)`, which reaches the editor and
sets its active target. React renders `SourceDialog`; its hook loads available
options. Search and selection stay local to the dialog. Confirming calls the
editor's mapping reducer and closes the dialog. The updated state flows back down
as props, updating counts and controls. Navigation changes the displayed form,
but the reducer remains mounted above it, preserving saved mappings.

`useMemo` keeps provider context objects stable between renders with the same
inputs. It does not fetch or store a second mapping state. `useRef` gives React a
place to attach a DOM element for focus; changing a ref does not trigger rendering.

## Validation evidence

Local validation on 2026-10-15:

- Full unit/component suite: 347 tests across 21 files passed.
- New regressions verify canonical provider inputs, no requests for unmapped
  fields, no request restart during search/settings/parent renders, and correct
  target fields after navigation while preserving earlier mappings.
- Existing coverage includes form isolation, counts, toggles, graph/configuration
  changes, cancellation, disabled source preservation, and clear/cancel focus.
- Lint, formatting, strict application/harness typechecks, and production build pass.
- All 16 Chromium acceptance scenarios pass against the pinned official mock over
  real HTTP, including all eight source combinations and native dialog keyboard flow.

See PR #18 for CI on the pushed commit. Local tests and CI do not establish a
production deployment or Firefox/Safari/screen-reader certification.

## Remaining risks and next phase

Mappings remain session-only. Fallback labels remain separate from references.
Mapped fields retain individual availability requests; no caching or batching is
introduced. The intended UI is unchanged, so this phase uses existing browser
assertions rather than a new visual design.

O4 evaluates colocating fallback labels with mappings, measures repeated catalog
requests before considering caching, and reviews async hook duplication. Adopt
only changes with demonstrated value; a generic hook or cache is not required.
