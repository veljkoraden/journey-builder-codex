# Reviewer handoff

## Scope delivered

The independent app loads and validates the official form graph, lists form
instances, and edits session-only prefill references. Direct, indirect, and global
sources share one provider contract. Served JSON selects any subset without a
rebuild. New provider code requires registration and a build; the executable
[extension guide](provider-extension.md) demonstrates this distinction.

Start with [README](../README.md), then the [React walkthrough](architecture.md)
and [five-minute demonstration](demo.md). The [phase plan](implementation-plan.md)
links the incremental implementation and validation records.

## Evidence and review order

[Phase 12](phase-12-handoff.md) records fresh-install validation. Browser tests use
real HTTP with the pinned official mock and the production bundle, including
native dialog behavior and narrow layouts. Unit/component tests cover invalid
data, graph traversal, source failures, cancellation, and mapping isolation.
Neither test layer proves a production deployment, real customer data, or backend
persistence.

The delivery correction was merged through PR #15 at `8ba5b7d`, preserving
alphabetical forms and inline Direct/Transitive badges. Earlier Phase 11/12 PRs
were merged into intermediate branches, so their tests and handoff files did not
reach main. PR #15 restored them together directly to main.
See [delivery verification](delivery-verification.md) for current combined evidence.
Historical phase documents retain their original validation results; they are not
claims about the current merge or CI status. Its PR CI passed; consult the repository for subsequent CI status. No automatic merge, deployment, or submission is performed.

## Known limitations

- Mappings and editing switches reset on page reload. The mock has no mapping
  write endpoint; nonempty incoming mappings have no verified contract.
- The mock route has no version segment. The linked sandbox API documentation
  was unavailable during investigation. A production integration must verify its
  endpoint, authentication, versioning, and persistence contracts.
- Sources describe references, not actual submitted-value evaluation. Types are
  displayed, not enforced through a complete schema/coercion engine.
- Browser automation covers Chromium only. Other browsers, screen readers, and
  physical devices need separate checks; jsdom dialog shims cannot prove modality.
- Catalogs await all selected providers; large/remote catalogs may require batching,
  caching, and timeouts. Confirmation checks the current catalog, not a fresh
  remote transaction.
- Configuration is public. No secrets, authorization layer, database, form execution,
  graph canvas, deployment, or production monitoring is included.
- Future tenant/version switching needs explicitly scoped state or owner resets.
- The team-directory example is opt-in sample metadata, not a directory integration.

## AI use and live-session ownership

AI assisted implementation, tests, and documentation. The project was implemented
independently from the challenge and official mock; a separately requested
read-only architecture comparison did not supply application code. A reviewer
should be able to explain normalization versus TypeScript types, reverse graph
traversal, stable reference identity, effect cleanup, and draft versus committed
React state. Practice these with the walkthrough and extension example before the
live session.

The original delivery phases are complete. The next development work is the
[planned optimization](optimization-plan.md) tracked in issue #16. Its five phases
preserve source extensibility and existing behavior; none is implemented yet.
Challenge submission remains a separate action by the submitter.
