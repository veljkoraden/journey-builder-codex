# Architecture and React walkthrough

## Files by responsibility

```text
index.html                      root DOM element and module entry
src/main.tsx                    createRoot, StrictMode, CSS import
src/app/App.tsx                 composition and shared source configuration
src/blueprint/                  endpoint, HTTP client, normalization, model, hook
src/dependencies/               validated graph index and ancestor queries
src/sources/                    provider contracts, registry, configuration, catalog
  providers/                    direct forms, indirect forms, sample globals
  examples/teamDirectory.ts     tested opt-in extension
src/mappings/                   immutable reducer, identity, hook, mapped counts
src/ui/                         form navigation, editor, controls, source dialog
src/test/                       independently authored fixtures and DOM setup
public/source-config.json       runtime provider selection
e2e/                           browser tests and pinned official mock
docs/                          setup, architecture, extension, phase evidence
```

Tests live beside the behavior they verify. Browser tests are separate from the
Vitest suite. Production output is `dist/`.

## Which files run first?

```text
index.html → main.tsx → App
  ├── useSourceConfiguration → configuration.ts → public JSON → registry
  ├── SourceConfigurationStatus receives configuration state
  └── BlueprintConnection → useBlueprint → loadBlueprint
      → client.fetchBlueprint → normalizeBlueprint → createDependencyGraph
      → PrefillEditor
          ├── usePrefillMappings → mappingReducer
          ├── summarizeMappings → per-form counts
          ├── FormBrowser → FormList + FormFields → MappingControls
          └── SourceDialog → useSourceCatalog → loadSourceCatalog → providers
                  └── SourceGroupChoices
```

The HTML loads `main.tsx`, which mounts React into the root DOM element. React
calls `App` to calculate the initial UI. Effects start network work after render;
when hook state changes, React renders again. Imported files define types and
functions; importing a provider does not automatically load its options.

Configuration and blueprint loading are independent. Mapping controls require a
valid configuration; browsing depends on a valid blueprint. One configuration
hook result is passed to both the editor and status display, avoiding conflicting
copies of enabled-source state.

## What model.ts does

`src/blueprint/model.ts` describes the normalized data the application expects:
Blueprint, FormInstance, and FormField. These TypeScript interfaces help the
compiler check function inputs and props. They do not validate incoming JSON at
runtime. `normalizeBlueprint.ts` performs that separate boundary check.

`src/sources/model.ts` describes provider context, groups/options, and stable
references. `src/mappings/model.ts` describes target identity, state, and actions.
Each model belongs to one responsibility; UI components do not interpret raw API
objects.

## Graph direction and identity

For A → B → D, D's direct dependency is B and its indirect ancestor is A. Edges
are this implementation's authority; supplied prerequisite metadata must agree.
Missing endpoints, duplicate identities, disagreement, and cycles block loading.
Null prerequisite metadata means absent; an explicit empty list is cross-checked.

The dependency service indexes the graph once per loaded response. Queries use
iterative traversal and visited sets; indirect ancestors exclude direct parents
and the target itself. Non-form nodes are traversed but not offered as form sources.
This policy is deliberate, not a claim that every future API treats edges as canonical.

A form node is an instance; a form definition is a reusable template. Two nodes
sharing a definition still have separate mappings. Targets use blueprint ID,
node ID, and field key. Sources use provider ID, resource ID, and path segments.
Labels never identify mappings. A literal key `contact.email` is one segment,
not the nested path `["contact", "email"]`.

## Where React state belongs

- `App` owns runtime source configuration through a hook.
- `FormBrowser` owns the selected form ID and sorts a copy of the forms by name,
  ignoring capitalization. Initial/fallback selection uses the first sorted form.
- `PrefillEditor` owns saved mappings, per-form editing switches, and the active
  dialog target. This owner stays mounted while forms change.
- `SourceDialog` owns the temporary draft and search text. Cancel discards this
  state without dispatching a mapping action.
- `SourceGroupChoices` owns expansion. Search temporarily reveals matches.
  Provider descriptions appear as inline badges and accessible group descriptions.
- Counts are derived from current fields and saved references rather than stored
  separately, preventing counts from drifting after edits.

A reducer is a plain function returning the next state for an action. The mapping
reducer copies changed data and preserves previous snapshots. `useReducer`
connects it to React. Set also replaces; clear is safe when no mapping exists.
The editor's switch disables editing, not backend execution, and retains state.

Props carry data down; callbacks carry user intent up. `renderFields`,
`renderControls`, and the field header slot are composition: generic browsing
components accept editor content without learning mapping/provider rules.

## Requests, effects, and stale results

Effects own AbortControllers. Cleanup aborts previous work on unmount or changed
inputs. Hook results include input identity and attempt numbers, preventing old
responses from briefly appearing while a new effect starts. Catalog cancellation
also stops waiting for uncooperative providers; underlying providers should still
honor the signal to stop their own work.

The dialog resolves a draft against its current successful catalog before commit.
Changing configuration/graph invalidates the active target. There is no remote
re-fetch on confirmation. Provider failures retain healthy results; the aggregator
waits for all selected providers rather than streaming partial completion.

Mapped controls check the saved reference's provider separately. Disabled, missing,
or failed sources are labeled without deleting the mapping. Large remote catalogs
may later need batching/caching and explicit timeouts.

## Field and persistence policy

Button controls are excluded from prefillable targets, while array/object fields
remain eligible. Source providers expose schema properties including button
outputs, consistent with the challenge screenshot. No undocumented output fields
are synthesized and no full JSON Schema/type-coercion engine is implemented.

Mappings, switches, and label snapshots are memory-only. Reload/unmount resets
them. The mock exposes no save route; incoming nonempty server mapping contracts
are unverified. Future tenant/version switching needs explicit scope or owner
reset. See [handoff](handoff.md) for the complete limitations.

## Planned optimization

The [optimization plan](optimization-plan.md) tracks proposed readability and
composition changes. This guide describes the current implementation. Existing
source combinations must remain configuration-only, and new providers must remain
registerable without changes to the dialog, mapping reducer, or graph traversal.
