# Optimization O4 — Mapping snapshots and request evaluation

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Delivery: an additional commit on existing PR #18, after O1–O3.

## Adopted change: one saved mapping owns its fallback label

Previously `PrefillEditor` coordinated two stores: a mapping reducer keyed by target
and a label dictionary keyed by source reference. Confirming updated both stores;
clearing removed only the mapping. Two target fields referencing the same source
could overwrite each other's fallback text if a provider returned target-specific
labels.

`SavedMapping` now contains `{ source, fallbackLabel? }`. Each target owns one
immutable record. Confirmation dispatches source and label together; clearing
removes the entire record. The editor no longer maintains or passes a separate
label dictionary. This is a small correctness improvement as well as a simpler
state flow.

A source's identity remains its provider ID, resource ID, and field path. Labels
are presentation snapshots, not identifiers. Reselecting the same reference and
label is a no-op. Reselecting with a new label updates the snapshot while retaining
the existing source object, avoiding an unnecessary availability request.

`getSavedMapping` reads the complete record for the UI. `getMapping` continues to
return just the source for reference-only consumers such as mapping counts.
Callers may omit a snapshot; controls then fall back to the resource/path text.
Available live catalog labels still take precedence over the snapshot. A retry
that returns a new live label does not silently rewrite the saved snapshot; that
snapshot represents the last confirmed selection.

There is no persistence migration: mappings are still held only in memory.
Provider contracts and runtime configuration are unchanged.

## Request measurement and caching decision

The integration test named “measures target-specific requests and preserves
independent fallback labels for a shared source” instruments `getGroups` on a
registered test provider. It returns different labels for Email and Name while
using the same source reference, exercising the allowed target-field dependence.
The test runs without StrictMode to count ordinary lifecycle requests precisely.
Existing StrictMode, cancellation, stale-response, and retry tests remain in place.

| Interaction | Additional provider calls | Cumulative calls |
| --- | ---: | ---: |
| Render unmapped fields | 0 | 0 |
| Open Email dialog and confirm | 2 | 2 |
| Open Name dialog and confirm | 2 | 4 |
| Rerender with unchanged inputs | 0 | 4 |
| Navigate to an unmapped form | 0 | 4 |
| Return to the two mapped fields | 2 | 6 |
| Disable the provider through configuration | 0 | 6 |

Each dialog loads once, each new mapping checks availability once, and remounting
mapped fields checks each again. O3's stable contexts prevent unrelated rerenders
from restarting requests. These are provider invocation counts, not HTTP request,
latency, production traffic, or browser development StrictMode measurements. The
shipped providers derive catalogs locally; future providers may perform network I/O.

**Decision: retain individual requests.** Sharing by form ID would incorrectly
reuse results across target fields. A safe cache would need graph, target field,
provider/settings, and refresh identity plus eviction, invalidation, and cancellation
rules. The measured small local workload does not justify that complexity. Revisit
with an actual remote provider or measured latency; no performance speedup is claimed.

## Async hook review

The three hooks already share an understandable lifecycle: an attempt counter,
an effect with an AbortController, an aborted-result guard, and input identity
checks before exposing results. Their responsibilities remain different:

| Hook | Input and lifecycle differences |
| --- | --- |
| `useBlueprint` | Nullable endpoint; idle state; normalized graph and dependency validation; whole-request failure |
| `useSourceConfiguration` | Always loads a URL; validates enabled and disabled entries; loading/error blocks editing |
| `useSourceCatalog` | Nullable target; context, selection and registry identities; successful catalog can include individual provider failures |

**Decision: keep explicit domain hooks.** A common hook would require a generic
input key, idle policy, loader, error mapping, and result shape. It would move the
lifecycle rules into an abstraction without removing the domain decisions. No
hook or cancellation code is changed in this phase.

## Files and beginner React walkthrough

```text
src/mappings/model.ts               SavedMapping, MappingState, mapping actions
src/mappings/reducer.ts             atomic set/clear, immutable source/label records
src/mappings/usePrefillMappings.ts  React reducer hook; dispatches confirmed label
src/ui/PrefillEditor.tsx            mapping owner; no separate sourceLabels state
src/ui/PrefillForm.tsx              reads a saved record and passes source + snapshot
src/mappings/reducer.test.ts        label isolation, replacement, identity, atomic clear
src/ui/PrefillEditor.test.tsx        field-dependent provider and request measurement
```

Application startup is unchanged:

```text
index.html → src/main.tsx → App
  ├── useSourceConfiguration → runtime JSON + registry
  └── BlueprintConnection → useBlueprint → loadBlueprint
      → fetch client → normalization + dependency validation
      → PrefillEditor → FormBrowser → PrefillForm → FormFields
          ├── PrefillSettings
          └── MappingControls → useSourceCatalog
      → SourceDialog (only while a target is open)
          → useSourceCatalog → loadSourceCatalog → registered providers
```

`main.tsx` mounts `App` using `createRoot` and StrictMode. Loading hooks update state
when data arrives, so React renders the editor. Opening a field sets the editor's
active target, causing `SourceDialog` to mount and request options. Choosing an
option changes only the dialog's draft.

Confirming calls `PrefillEditor.confirmSource(source, label)`, which calls
`usePrefillMappings.setMapping(target, source, label)`. The hook dispatches one
`set` action. The reducer is a plain function: it computes the next immutable
state without fetching or touching the screen. React rerenders the editor with
that state. `PrefillForm` reads the saved record and passes its pieces as props to
`MappingControls`, which prefers a live label when available.

Clearing dispatches `clear`, removing both source and snapshot. Navigation does
not unmount the reducer owner, so saved records survive switching forms. No second
state store or synchronization effect is needed.

## Validation evidence

Local validation on 2026-10-15:

- 352 unit/component tests across 21 files passed, including five new O4 tests.
- Existing live-label/retry tests verify live labels override snapshots. Existing
  graph, configuration, isolation, cancellation, focus, and extension coverage stays.
- Application/harness typechecks, production build, Hooks lint, and formatting pass.
- All 16 Chromium scenarios pass, including all eight runtime source combinations,
  mapping navigation/replacement/clear, configuration recovery, and native focus.
- Relative documentation links and `git diff --check` pass.

CI results belong to the pushed commit on PR #18; local evidence is separate.
Neither constitutes deployment or Firefox/Safari/screen-reader certification.

## Remaining scope and next phase

Snapshots may be older than the current catalog by design; available live labels
win. Mappings remain session-only. Caching, batching, and a generic async hook are
explicitly deferred for the reasons above. New executable providers still require
registration and a build; enabling installed providers remains a JSON-only change.

O5 will execute and simplify the provider-extension walkthrough in a disposable
checkout, verify configuration-only subsets and an additional provider, and add a
short “read these files first” learning path to the current architecture guide.
