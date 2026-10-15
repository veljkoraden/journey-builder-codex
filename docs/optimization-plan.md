# Optimization plan

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Status: **Planned — no optimization phases implemented yet.**
Baseline: main `8ba5b7d`, following the original twelve delivery phases and the
merged handoff correction in PR #15. These five optimization phases are numbered
separately from the original implementation plan.

## Purpose

Make the application easier to read, explain, maintain, and extend. Preserve
existing behavior while simplifying dense callbacks, conditional expressions,
repeated catalog processing, and editor context construction. Fewer lines or
files are not success criteria; clearer ownership and fewer repeated decisions are.

## Extensibility requirements

- Direct, transitive, and global sources remain separate providers. Any of their
  eight combinations, including none, must work through served runtime JSON
  without application-code changes or a JavaScript rebuild.
- In development, edit `public/source-config.json`. After deployment, edit the
  served JSON beside `index.html`. Refresh source settings to apply changes while
  preserving mappings; page reload resets session state.
- A new source requires implementing `SourceProvider` and registering it once.
  Its activation and supported settings then become configuration-driven. New
  executable provider code still requires a build.
- Keep the UI, reducer, and traversal independent of provider IDs and behavior.
  Preserve stable references, settings validation, cancellation, stale-result
  protection, and failure isolation.
- Unavailable sources must not silently delete saved mappings. Keep replacement
  and clearing available when editing is enabled.
- Preserve DAG eligibility: D has B as direct and A as transitive; F has D/E as
  direct and A/B/C as transitive. Direct membership wins over a longer path.

## Phases

| Phase | Status | Work and explanation | Completion evidence |
| --- | --- | --- | --- |
| O1 — Readability | Planned | Named props interfaces and handlers, descriptive variables, expanded JSX/branches, formatting and React Hooks lint checks. Separate mechanical formatting from behavior changes. | Existing behavior preserved; tests/build and introduced checks pass. |
| O2 — Shared decisions | Planned | Small pure helpers for catalog groups, reference lookup, labels, availability, and search. Make no-match feedback use the same matching rules as displayed results. | Focused decision tests; existing search, draft, failure, and availability behavior passes. |
| O3 — Editor composition | Planned | Extract meaningful selected-form/settings components. Keep durable mapping state above form switching. Replace eager contexts for every form/field with stable contexts near their consumers. | Navigation, mapping isolation, toggles, cancellation, focus, and graph/config replacement remain correct; no request loops. |
| O4 — Evaluate simplification | Planned | Evaluate storing label snapshots with mappings; measure repeated provider requests; standardize asynchronous hook layout. Introduce caching or shared hooks only with demonstrated benefit. | Evidence for each adopted change and regression coverage; explicitly document deferrals. |
| O5 — Extension and learning | Planned | Update the executable provider walkthrough and add a concise file-reading sequence. Keep current instructions separate from historical phase records. | Execute setup and provider-extension instructions in a disposable checkout without consumer or test-expectation edits. |

## Main files involved

- Editor composition: `src/ui/PrefillEditor.tsx`, `FormBrowser.tsx`, `FormFields.tsx`.
- Selection and availability: `src/ui/SourceDialog.tsx`, `SourceGroupChoices.tsx`,
  `MappingControls.tsx`.
- Provider boundary: `src/sources/model.ts`, `registry.ts`, `configuration.ts`,
  `loadSourceCatalog.ts`, and the source/configuration hooks.
- Mapping ownership: `src/mappings/model.ts`, `reducer.ts`, `usePrefillMappings.ts`.
- Regression coverage: colocated tests, `e2e/journey.spec.ts`, and
  `.github/workflows/validate.yml`.

Preserve canonical form/field objects and stable context identity when changing
composition. Providers can depend on the target field: caching only by form ID
would be incorrect. Keep cancellation and input-identity guards even if they
appear repetitive. Avoid introducing a generic framework solely to shorten JSX.

## How to extend a data source during this work

The current [provider-extension guide](provider-extension.md) remains the supported
workflow. Implement the interface, validate settings, return stable groups/options,
register the provider, and enable it in runtime JSON. Use
`src/sources/examples/teamDirectory.ts` and its tests as an executable example.
No changes to the dialog, mapping reducer, or graph traversal should be required.
The provider remains opt-in; changing valid combinations must not require changing
test expectations. Remote providers must honor cancellation and validate responses.

## Test and review gates

The baseline has **319 unit/component tests and 16 Chromium scenarios**; these
counts describe existing coverage, not a target to increase for its own sake.

Preserve coverage for:

- DAG validation, direct/transitive ancestry, deduplication, and excluded nodes.
- All eight source combinations with unchanged built JavaScript assets.
- Invalid configuration, empty configuration, and a registered additional provider.
- Stable identities, provider failures, cancellation, and stale responses.
- Assign/replace/clear/cancel, mapping isolation, refresh, toggles, and reload reset.
- Native dialog focus/keyboard behavior, sorted forms, badges, and narrow layouts.

Run `npm run test:run`, `npm run build`, and `npm run test:e2e`, plus lint/format
checks when introduced. Browser tests include application and harness typechecks.
Verify the empty shipped configuration and documented provider extension without
editing tests. Do not replace behavior tests with implementation snapshots.

Each phase should report changed files, a short explanation, validation evidence,
risks/deferrals, and its next step. Prefer a focused PR directly against main after
prerequisites merge. Verify the final change actually reaches main; a merge into
an intermediate branch is not delivery. Do not merge automatically.

## Boundaries

No new persistence, authentication, form execution, graph canvas, deployment, or
runtime plugin loader is included. Chromium validation is not proof of Safari,
Firefox, screen-reader, or production behavior. Do not remove validation or
accessibility to make the code smaller. Existing session-only semantics remain.
