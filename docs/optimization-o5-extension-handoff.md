# Optimization O5 — Executable extension and learning handoff

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Delivery: an additional commit on existing PR #18, following O1–O4.

## What changed and why

The provider architecture already supports the required extension flow. This phase
makes that flow easier to follow and verifies it without changing production code.

The extension guide now distinguishes three tasks: selecting installed sources,
changing their supported settings, and installing new provider behavior. It gives
a concrete JSON subset and five steps for the working team-directory example:
read/test, register, enable, validate, and exercise settings changes. It explains
why a local catalog still uses an async method and where a future remote provider
must handle fetching, cancellation, and response validation.

The architecture guide now starts with a short reading path. Its main render-flow
diagram includes `PrefillForm` and `PrefillSettings`, correcting the older diagram
that skipped the components introduced in O3. The README links this final phase.

The example's integration test now confirms behavior across settings changes:
renaming refreshes the live label; disabling preserves the confirmed snapshot;
re-enabling preserves the mapping; changing the resource ID marks the old source
unavailable; clearing removes it and restores focus. This runs the actual example
through the generic editor, registry, and configuration parser.

## Files and responsibilities

- `docs/provider-extension.md`: current step-by-step contributor instructions.
- `docs/architecture.md`: current reading order and component/render flow.
- `README.md`: entry point and optimization progress.
- `src/sources/examples/teamDirectory.test.tsx`: settings lifecycle regression.
- This document: reproducible evidence and scope boundaries.

Production provider, registry, dialog, reducer, and graph code are unchanged.
The example remains opt-in and absent from the default registry imports.

## Disposable-checkout verification

Starting from O4 commit `3b51be3`, exported the repository to
`/tmp/journey-o5-extension-2LALgZ` and copied in the new O5 example test. Installed
locked dependencies with `npm ci --no-audit --no-fund` (269 packages).

Executed two configurations there, without changing test expectations:

1. Replaced `public/source-config.json` with `{"providers": []}`. Ran the complete
   unit/component suite and production build. All 353 tests passed and build passed.
2. Followed the documented registration steps: imported `teamDirectory` in
   `src/sources/registry.ts`, added it to `createSourceRegistry`, and enabled its
   documented onboarding settings alongside the three built-ins in JSON. Ran the
   same complete suite and build. All 353 tests passed and build passed.

Only the registry and runtime JSON differed from the O5 code used for validation.
No dialog, mapping reducer, dependency traversal, or test expectation changes were
needed for either configuration. The disposable registration is not included in
PR #18; the shipped app retains its original three providers.

To reproduce in your own disposable checkout, follow the five numbered steps in
[the extension guide](provider-extension.md). For the empty case, replace the
configuration with the empty providers array before running its validation commands.

The extension editor interaction is tested in jsdom. The Chromium suite separately
verifies the built-in providers over real HTTP; it does not constitute a real
remote team-directory service or a manual browser check of that extension.

## Learning React: startup and extension flow

```text
index.html → src/main.tsx → App
  ├── useSourceConfiguration → configuration.ts → served JSON + sourceRegistry
  └── BlueprintConnection → useBlueprint → loadBlueprint
      → HTTP client → normalization + dependency validation
      → PrefillEditor → FormBrowser → PrefillForm → FormFields
          ├── PrefillSettings
          └── MappingControls
      → SourceDialog → useSourceCatalog → loadSourceCatalog
          → registry.resolve → each enabled provider.getGroups
          → SourceGroupChoices
```

`index.html` supplies the root DOM element and loads `main.tsx`. `main.tsx` mounts
`App` with `createRoot` and StrictMode. `App` coordinates configuration and graph
loading. State updates from those hooks cause React to render again.

`PrefillEditor` owns saved mappings above form navigation. `FormBrowser` selects
a form, and `PrefillForm` supplies header and control components to the reusable
`FormFields` layout. Clicking a field opens `SourceDialog`. Its hook asks the
catalog loader for options, and the loader resolves enabled providers through
the registry. The dialog renders their common group/option structure; it does not
need to know whether the options came from a form, global catalog, or team directory.

Importing a provider defines its behavior; it does not automatically enable it.
Registration makes that behavior available. Runtime JSON selects it and supplies
settings. That separation is why existing source combinations need no React edits,
while genuinely new behavior requires an implementation, registration, and build.

Selecting an option changes only dialog draft state. Confirming calls the editor,
which dispatches one reducer action with source reference and fallback label.
The changed mapping state flows down through props, and React updates the controls.
Changing settings refreshes availability without silently deleting saved mappings.

## Validation evidence

Local checks on 2026-10-15:

- Default checkout: 353 unit/component tests across 21 files passed.
- Example module: 20 tests passed, including the new settings lifecycle test.
- Disposable empty configuration: 353 tests and production build passed.
- Disposable registered team-directory configuration: 353 tests and build passed.
- Default application/harness typechecks, build, lint, and formatting passed.
- All 16 Chromium scenarios passed, including all eight runtime source subsets,
  settings recovery, mapping lifecycle, native dialog focus, and narrow layouts.
- Relative documentation links and `git diff --check` passed.

An initial run of two full unit suites alongside Chromium exceeded the existing
five-second timeout in the same editor interaction test in both checkouts. The
suites were rerun sequentially with unchanged timeouts and assertions. This points
to resource contention, rather than proving timing robustness under heavy load.

CI is checked separately on the pushed PR commit. No merge or deployment is implied.

## Remaining risks and next step

This completes the five optimization phases in issue #16. PR #18 remains the review
unit; do not automatically merge it or close the issue before acceptance.

Mappings remain session-only, the example is a catalog of references rather than
real team data, and browser automation covers Chromium. O4's caching and generic
hook deferrals remain intentional. Runtime JSON is public; it cannot install
arbitrary code or carry secrets. A remote provider needs additional service and
authentication design plus response-validation tests.

Next: review the cumulative PR against issue #16, then merge only when authorized.
No O6 or additional runtime framework is proposed.
