# Phase 5 — Source providers

## Outcome and scope

Phase 5 implements a uniform source catalog for a selected form field. Direct forms, indirect forms, and sample organization properties use the same asynchronous provider contract. No React components or API behavior change in this phase. Phase 4 was merged as PR #3 before this branch began.

The implementation is independent. The earlier comparison with Claude informed an architectural discussion; no source files were copied or imported.

## Architecture for someone learning React

React renders components, but not every application function needs to be a component or hook. These modules are ordinary TypeScript services: they calculate the choices that a future React dialog will display. Keeping this work outside React makes it easier to test and reuse.

```text
src/sources/
  model.ts                    shared contracts and reference identity
  registry.ts                 installed providers and selection validation
  loadSourceCatalog.ts        concurrent execution, validation, cancellation
  providers/
    formSources.ts            direct and indirect upstream form fields
    globalProperties.ts       sample organization references
    settings.ts               explicit built-in settings policy
  sources.test.ts             provider and aggregator behavior tests
```

- `model.ts` describes groups, options, references, context, selections, and results. An interface is a TypeScript contract, not a component and not a runtime API validator. A source reference stores provider ID, resource ID, and a field-path segment array. Labels can change without changing identity. `sourceReferenceKey` safely serializes that identity for comparison.
- `registry.ts` registers the three built-ins. Its factory accepts other providers and checks duplicate/empty IDs. `resolve` validates selected IDs before any provider runs, preserving requested order. It uses a private Map, so IDs such as `constructor` do not collide with object properties.
- `formSources.ts` asks Phase 4's dependency service for upstream forms. It does not implement another traversal. Direct and indirect providers share conversion code but have distinct IDs. Forms without fields are omitted. All available source fields, including button outputs, remain visible; target-field filtering is a separate existing rule.
- `globalProperties.ts` offers organization name and support email references, even when the target is a root form. These are sample catalog entries, not live organization data or evaluated values.
- `settings.ts` rejects supplied settings for built-ins because none are currently supported. Custom providers receive their settings unchanged and must validate them.
- `loadSourceCatalog.ts` checks that the selected form and field belong to the loaded normalized model, resolves selections, starts providers concurrently, and returns success/error results in selection order. It checks group IDs and reference uniqueness/namespaces so ambiguous options become an isolated provider error.

## What loads first?

The existing render path stays:

```text
index.html → src/main.tsx → App → BlueprintConnection
  → useBlueprint → loadBlueprint
    → client → normalizeBlueprint → createDependencyGraph
  → existing form list and field details
```

**The source layer is not called by that render path yet.** Its tests call it directly. Importing a module defines functions; it does not automatically fetch options. Later, a source dialog will call:

```ts
const results = await loadSourceCatalog(
  sourceRegistry,
  [{ id: "direct-forms" }, { id: "global-properties" }],
  { blueprint, dependencies, targetForm, targetField },
  controller.signal,
);
```

For Form D, the example yields Form B and global properties; adding `indirect-forms` adds Form A. `targetForm` and `targetField` must be actual objects from that blueprint, not reconstructed copies. A new blueprint load must create a new context and cancel old work.

The caller owns loading state while the Promise is pending. Each settled provider has `success` with groups (possibly empty), or `error` with a message. Cancellation rejects the whole request, rather than presenting cancellation as a provider outage. The caller must handle that rejection. The aggregator waits for all providers; progressive per-provider UI is not implemented.

## Why these choices?

- Node IDs preserve distinct form instances that share one definition.
- Array paths preserve literal dotted keys and permit future nested references.
- The asynchronous contract supports future remote providers without changing the catalog interface.
- Per-provider errors retain healthy results when another source fails.
- Abort races stop waiting even if a provider ignores its signal; late resolve/reject is handled. Providers should still cooperate with cancellation to stop underlying work.
- Existing provider combinations are selected by data; runtime JSON loading comes in Phase 6.
- No type-compatibility filtering is inferred from incomplete field schemas.

## Extending the catalog

Implement `SourceProvider`, give it a stable ID, and return groups/options using that ID in every reference. Group IDs must be unique within a provider; references must be unique across all its groups. Resource IDs for form data identify nodes, not definitions. Register the provider at the composition boundary, then select its ID. New provider implementation/registration requires a build; changing existing combinations through deployed JSON will not once Phase 6 is complete.

The test-only fourth provider proves that registration is sufficient without modifying aggregation logic. UI extension proof remains Phase 9.

## Validation evidence

- `npm run test:run`: 173 tests passed across 10 files, including 36 new tests.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Coverage includes D and F ancestry, root global options, shared definitions, dotted keys, button outputs, empty/non-form intermediates, label stability, no input mutation, all eight subsets, fourth-provider registration, settings forwarding/rejection, invalid selections and stale targets, concurrent start/order, synchronous/asynchronous errors, pre-abort and mid-request cancellation with late resolve/reject, and malformed identity isolation.
- No browser scenario is claimed: this phase changes no UI and is not wired into React yet.
- No package or lockfile changes. Validation uses existing installed dependencies.

## Remaining risks and deferrals

Runtime configuration and configuration-error UI are Phase 6. Mapping state is Phase 7; the dialog begins in Phase 8; UI search, stale-target lifecycle integration, and provider failure feedback are Phase 9. No server persistence, submitted-value evaluation, remote provider, or automatic timeout is added. A provider that never settles requires caller cancellation; successful results are not streamed while waiting. Output validation enforces identities but is not a general untrusted-data schema validator. Context must use a dependency service created for the same blueprint; composition owns that pairing.

## Next phase

Phase 6: load and validate public runtime source configuration, select providers without rebuilding, and demonstrate all combinations through the configuration boundary.
