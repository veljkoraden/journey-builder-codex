# Handoff and acceptance delivery correction

## Scope

Based directly on main `84a8707`, this correction recovers the Phase 11 acceptance
suite and Phase 12 handoff/example files. Their original PRs were merged into
intermediate branches and did not reach main. The corrective PR targets main
directly and preserves alphabetical form ordering and inline Direct/Transitive
badges already merged there.

Restored artifacts include the pinned official mock, Playwright environment,
Chromium scenarios, CI workflow, architecture/extension/demo guides, and executable
team-directory example with 19 tests. README describes the completed application,
current setup, runtime configuration, validation commands, and session-only state.
Historical phase records are labeled; this document is the current combined
validation record.

## Configuration and test correction

The shipped JSON must be valid, but no particular source subset is mandatory.
The unit test now checks runtime validation rather than demanding all three IDs.
The separate eight-subset tests retain explicit expected catalogs. Browser
scenarios own their baseline configuration, so a developer's valid shipped subset
does not change what a mapping scenario is testing.

The extension guide no longer asks developers to modify test expectations after
registering a provider. Existing combinations need only runtime JSON edits;
implementing a new provider still requires code, registration, and a build.

Recovered browser assertions now check sorted form navigation and the current
inline Direct/Transitive labels, including accessible descriptions. Existing
real-HTTP coverage includes mapping/replace/clear, native dialog keyboard behavior,
all eight source subsets without changing JavaScript assets, invalid config,
server/graph recovery, and 320/390/768px layouts.

## Validation — 2026-10-15

A fresh worktree with its own `npm ci` installation passed:

- 319 unit/component tests across 19 files.
- Application TypeScript and production build.
- Browser-harness TypeScript and all 16 Chromium acceptance scenarios.

The browser suite starts its own pinned official mock and serves this checkout's
production build over real HTTP. It does not intercept API requests. Existing
installed Chromium binaries were reused; dependencies were freshly installed.

Additional verification:

- With shipped JSON temporarily set to `{"providers": []}`, all 37 configuration
  tests and all 16 browser scenarios passed without any test edits.
- Following the extension guide to register and enable `team-directory` passed all
  319 tests and the production build, again without changing tests.
- Original registry/configuration files were restored after these checks.
- All 60 relative links across 19 Markdown documents resolve.
- `git diff --check` passed.

## Delivery boundary

Local validation is distinct from GitHub CI. Check the corrective PR's validation
job for its current result. Review and merge this PR directly into main; there is
no intermediate feature-branch dependency. No automatic merge, deployment, or
challenge submission is performed. Session-only mappings, Chromium-only browser
coverage, and unverified production persistence contracts remain documented in
[handoff](handoff.md).
