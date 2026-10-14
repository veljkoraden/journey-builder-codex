# Phase 12 — Documentation and tested extension handoff

## What changed and why

Earlier phases completed the application and browser acceptance. This phase makes
that implementation easier to run, review, and extend. README now describes the
current product instead of accumulating early-phase setup fragments. Separate
architecture, provider-extension, demo, and handoff documents provide focused
paths for learning React and preparing the live session.

A small real `teamDirectory` provider makes the extension guide executable. It
validates settings, honors cancellation, and emits stable references for two team
fields. It is not registered in the default app. Tests configure it through the
same parser/registry/catalog path as production and map/clear it through the same
React editor. This prevents documentation from relying on an imaginary API.

## Files and React architecture

- `README.md`: installation, two-terminal startup, configuration, checks, guide links.
- `docs/architecture.md`: module tree, entry/render order, state and effect ownership.
- `docs/provider-extension.md`: runtime combinations and new-provider registration.
- `docs/demo.md`: reviewer demonstration including dependencies and cancellation.
- `docs/handoff.md`: limitations, review order, AI use, and submission boundary.
- `docs/implementation-plan.md`: completed-phase status and next review action.
- `src/sources/examples/teamDirectory.ts`: framework-independent sample provider.
- `src/sources/examples/teamDirectory.test.tsx`: settings, identity, cancellation,
  catalog integration, and React interaction tests.
- This file: phase purpose, architecture explanation, and evidence.

The render order remains `index.html → src/main.tsx → App → BlueprintConnection
→ PrefillEditor`. Hooks load configuration and the blueprint; normalized data and
the dependency service flow into the editor through props. Clicking a field mounts
SourceDialog, whose catalog hook asks registered providers for options. Selecting
an option changes local draft state; confirming dispatches the mapping reducer
and React renders the saved reference.

The example is loaded by its tests, or by the registry after following the guide.
It adds no default UI or startup request. Its module returns data; existing React
components render that data. This is why adding a source does not require rewriting
the dialog, graph traversal, or mapping reducer. TypeScript checks the contract at
build time; runtime validation checks the public JSON settings.

## Validation evidence

Fresh-checkout validation is recorded below after execution. The new example adds
19 tests. Existing browser acceptance remains the full Phase 11 suite; no new
browser claims or screenshots are needed for this documentation/opt-in example
increment.

## Remaining risks and next action

See [handoff](handoff.md) for session-only state, unverified backend contracts,
Chromium-only automation, remote catalog limits, and production deferrals.
Phase 12 depends on still-open Phase 11 and Phase 10 PRs. Local checks, GitHub CI,
merge, deployment, and submission are distinct events.

No Phase 13 is planned. Review and merge the stacked PRs in order, verify the final
branch, and use the demonstration guide for the live discussion.
