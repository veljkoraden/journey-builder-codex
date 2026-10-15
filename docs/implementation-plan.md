# Journey Builder Codex — investigation and phased implementation plan

Date: 2026-10-14
Status: Phases 1–12 implemented; see [Phase 12 handoff and validation](phase-12-handoff.md). Merge and submission remain separate.
Intended file: `/home/veljkoradenkovic/Documents/JOBS/Avantos/journey-builder-codex/docs/implementation-plan.md`.

## 1. Scope and independence

The original request established this plan; subsequent implementation requests authorize Phases 1–12. Build the future application independently from the challenge brief, screenshots, and official mock server. Do not copy, import, or modify the Claude application's source. A later user request authorized a read-only architectural comparison; implementation remains independent. Keep both versions separate. “Improved” means meeting the quality targets below; it is not a verified comparison against the other implementation.

The embedded challenge describes the eventual submission requirements. It does not instruct this planning session to publish a repository, send a submission, or start a four-day clock. The actual receipt date is unknown. Phases 1–4 provide the application shell, API connection, form browser, and dependency queries. Publication status belongs in the implementation handoff.

## 2. Investigation findings

### Verified from the supplied screenshots and brief

- A list of forms is sufficient; a node canvas is optional.
- Selecting a form exposes its fields and existing source mappings.
- An unmapped field opens a source-selection dialog. A mapped field has a clear action.
- The dialog groups sources, offers search, and separates tentative selection from confirmation.
- Sources include direct upstream forms, indirect upstream forms, and arbitrary global data.
- The prefill toggle appears in the reference; its exact semantics are unspecified.
- Evaluation emphasizes organization, extensibility, meaningful tests, and setup/extension documentation.

### Verified from the official mock sources

The server listens on port 3000 and handles `GET /api/v1/{tenantId}/actions/blueprints/{blueprintId}/graph`. It returns `graph.json`; no mapping-write route is implemented. Successful responses allow cross-origin access. [Server source](https://github.com/mosaic-avantos/frontendchallengeserver/blob/main/index.js)

The fixture has six form nodes, six directed edges, and three form definitions. Join `node.data.component_id` to `forms[].id`; use the node's name for display. Several nodes share a definition. Dependencies appear in both edges and `data.prerequisites`. Fields are described in `field_schema.properties`, alongside UI and dynamic configuration. All supplied `input_mapping` objects are empty. The topology is A→B, A→C, B→D, C→E, D→F, E→F. [Graph fixture](https://github.com/mosaic-avantos/frontendchallengeserver/blob/main/graph.json)

The mock README prescribes `npm start`. [Mock repository](https://github.com/mosaic-avantos/frontendchallengeserver)

### Evidence limitations

The linked [API documentation](https://admin-ui.dev-sandbox.workload.avantos-ai.net/docs#/operations/action-blueprint-graph-get) could not be retrieved through either the browser tool or shell. The graph was inspected through the browser retrieval tool; it may be a cached revision. Re-fetch and pin the mock revision during implementation. No server was started and no browser integration was executed in this phase. Nonempty server mapping serialization remains unverified; do not invent a backend contract.

## 3. Recommended implementation

### Small, understandable architecture

Use React, strict TypeScript, and Vite, with plain CSS. Select supported versions and lock dependencies when scaffolding. Use Vitest and React Testing Library for behavior tests; add a small browser smoke suite only after the core flow works. Native fetch and a reducer should suffice; avoid introducing a state framework, graph canvas library, or generic plugin loader for this challenge.

Proposed layout, created from scratch:

```text
src/
  app/                  application composition and selected-node state
  blueprint/            HTTP client, boundary validation, normalized model
  dependencies/         pure graph indexing and ancestor queries
  sources/              provider contract, registry, source aggregation
    providers/          direct forms, indirect forms, global properties
  mappings/             reference model, reducer, validation/selectors
  ui/                   form list, prefill editor, source dialog, status views
  test/                 setup and independently authored fixtures
public/
  source-config.json    runtime selection of installed source providers
docs/
  implementation-plan.md
```

Keep tests beside the behavior they verify. React components should consume normalized fields and source groups rather than interpret API JSON or traverse dependencies.

### Identity and graph correctness

Use separate types for blueprint IDs, node IDs, definition IDs, and field keys. Store mappings by blueprint ID, target node ID, and target field key. Store source node IDs for form references; never key mapping state by display names or reusable definition IDs.

Normalize edges into a predecessor index. Treat edges as the proposed canonical dependency relation, cross-check prerequisites, and report disagreement instead of merging contradictory graphs. Validate duplicate IDs, missing edge endpoints, missing form definitions, and cycles before enabling editing. Traverse all dependency nodes, but offer fields only from usable form nodes.

Compute direct predecessors separately from reachable ancestors. Indirect sources equal all ancestors minus direct predecessors and the target itself. Deduplicate nodes reachable through multiple paths. A node reachable both directly and indirectly belongs to the direct group only. Use deterministic ordering: direct before indirect, then display name with node ID as a tie-breaker. Cache normalized indexes for a loaded graph; avoid traversing on every field render.

### Data sources that can be combined without code changes

Separate implementing a new provider from enabling existing providers:

1. A developer adds a provider module and registers its stable ID at the composition boundary.
2. Runtime JSON chooses enabled providers and their settings; changing combinations requires no TypeScript or UI edits and no rebuild.

Example proposed configuration:

```json
{
  "providers": [
    { "id": "direct-forms", "enabled": true },
    { "id": "indirect-forms", "enabled": true },
    { "id": "global-properties", "enabled": true }
  ]
}
```

Validate configuration, including duplicate and unknown IDs. Test all eight subsets of the three provider types, including none. Ship the default configuration visibly; show an actionable error for invalid configuration rather than silently enabling everything. Configuration is public and must contain no secrets.

Suggested contract:

```ts
interface SourceProvider {
  id: string;
  getGroups(
    context: SourceContext,
    settings: unknown,
    signal: AbortSignal,
  ): Promise<readonly SourceGroup[]>;
}
```

`SourceContext` carries the normalized blueprint, selected target node and field, and dependency query functions. Each group contains labeled options with stable references and optional field-type metadata. Each provider validates its settings. Use a provider-namespaced, serializable reference such as `{ providerId, resourceId, fieldPath }`, with field paths represented as segment arrays to avoid dotted-key ambiguity. Provider IDs and resource IDs must remain stable across label changes.

Keep grouping, search, selection, and confirmation generic. No provider-specific branching in the modal. Support loading, cancellation, empty results, and per-provider failures; a failed provider should not hide successful groups. Ignore stale results when the user changes target or closes the dialog.

Use explicit sample globals such as organization name and support email. The UI configures references; it does not evaluate real submitted values. Adding a new provider necessarily requires implementation code, but selecting any combination of installed providers does not.

### Mapping and field policy

Use immutable reducer actions to set, replace, and clear mappings. Selection inside the dialog remains a draft until Select is pressed. Cancel, Escape, or closing must discard the draft. Revalidate source eligibility when committing.

Start with session-only state and say so in the UI and README. Reloading resets edits; no save endpoint exists in the mock. Do not claim server persistence. If a later contract documents incoming mappings, translate them through an adapter rather than assuming the local reference format is the server format.

List schema fields consistently and expose raw keys alongside friendly labels. Recommended target policy: exclude button controls from prefillable targets, retain array/object fields, and isolate that rule in a field-policy module. Reference images show some source fields absent from the mock schema; do not synthesize undocumented output fields. Keep source eligibility policy explicit and tested.

Display types as helpful metadata. Strict type compatibility and coercion are outside the initial requirement: do not hide valid-looking choices using an incomplete JSON Schema compatibility check. Document this limitation.

If implementing the reference toggle, disabling prefill preserves existing mappings but disables editing; reenabling restores access. This is a proposed product decision, not documented backend behavior. If runtime configuration disables a provider used by an existing mapping, show that reference as unavailable and allow clearing it; never silently delete it.

### UI improvements with bounded scope

Use a responsive form-list sidebar and selected-form detail panel. Show mapped-field counts and clear direct/indirect/global source labels. Include loading, retryable error, empty graph, no fields, no sources, and no search results states.

Use buttons for actions and a well-tested accessible dialog primitive or native dialog with explicit focus handling. Provide an accessible title, initial focus, focus containment, Escape behavior, return focus to the initiating field, and named clear controls. Use expandable groups with ordinary buttons and selectable options instead of implementing a complex ARIA tree unnecessarily. Provide source preview and keep Select disabled until an eligible option is selected. Allow clicking an existing mapping to replace it as a small usability improvement.

Defer node dragging, form execution, authentication, database persistence, undo history, elaborate theming, and deployment. These do not improve the core evaluation enough to justify their cost in the first delivery.

## 4. Small implementation phases

Complete these phases in order. Each delivers one reviewable piece. Add tests alongside the behavior they verify. At the end of each phase, record files changed, validation results, remaining limitations, and the next phase. A phase is complete only when its stated checks pass; implementation and browser verification are separate evidence.

Phases 1–12 have implementation and validation records in their phase documents. These smaller phases replace the earlier five-phase breakdown.

### Phase 1 — Create the independent project

**Status:** Complete; see [validation evidence](phase-01-foundation.md).

**Purpose:** Establish a clean application that can run and be checked before adding product behavior.

**Work:** Scaffold React, TypeScript, and Vite in the Codex directory. Add plain CSS, strict TypeScript settings, Vitest, React Testing Library, a lockfile, and scripts for development, type checking, testing, and building. Add a short setup README and public environment-variable example.

**Deliverable:** A minimal application shell with a heading and documented startup commands.

**Done when:** The shell runs locally, a basic render test passes, and type checking and production build succeed. No Claude application files have been reused.

### Phase 2 — Connect to the mock API

**Status:** Complete; see [validation evidence](phase-02-api-connection.md).

**Purpose:** Establish the real data connection before designing around assumed responses.

**Work:** Set up the official mock server separately and record its revision. Add configurable API URL, tenant ID, and blueprint ID. Implement a fetch client with HTTP/JSON error handling and cancellation. Revisit the API documentation if accessible.

**Deliverable:** A data-loading hook and a temporary loading/success/error view.

**Done when:** The browser receives graph JSON from the running mock. Client tests cover successful responses, non-success HTTP status, malformed JSON, and cancellation. Record any API details that remain unverified.

### Phase 3 — Normalize the data and display forms

**Status:** Complete locally; see [validation and React walkthrough](phase-03-form-browser.md).

**Purpose:** Give the UI a simple, reliable model and preserve each form instance's identity.

**Work:** Validate the required response structure. Join nodes to form definitions, extract field keys and labels, and render a selectable form list with field details. Add loading, retry, empty graph, and no-fields states. Keep the button exclusion rule in one field-policy module.

**Deliverable:** Users can select a form and see its fields, even when multiple nodes share a definition.

**Done when:** Tests prove shared definitions do not collapse distinct nodes, missing definitions produce an actionable error, and array/object fields remain available. Selecting one node shows that node's name and fields.

### Phase 4 — Calculate eligible upstream forms

**Status:** Complete locally; see [validation and React walkthrough](phase-04-dependencies.md).

**Purpose:** Prevent users from selecting unrelated or downstream form data.

**Work:** Build a pure predecessor index and ancestor query. Separate direct dependencies from indirect ancestors, deduplicate repeated paths, and use stable ordering. Detect cycles, duplicate IDs, missing endpoints, and disagreement between edges and prerequisites.

**Deliverable:** Tested graph functions that return eligible upstream nodes without React dependencies.

**Done when:** D has B as direct and A as indirect; F has D/E as direct and A/B/C as indirect, each once. Tests also cover roots, disconnected nodes, a diamond, a node reachable both directly and indirectly, and invalid graphs. Self and downstream nodes are never offered.

### Phase 5 — Add the three source providers

**Status:** Complete locally; see [validation and React walkthrough](phase-05-sources.md).

**Purpose:** Expose every source through the same contract so the UI stays independent of source-specific rules.

**Work:** Define source groups, options, stable references, and the provider interface. Implement direct-form, indirect-form, and sample-global providers. Add a registry and aggregator with cancellation and per-provider result states.

**Deliverable:** A uniform source catalog for a selected target field.

**Done when:** Provider tests return the correct groups and references. A root form can receive sample global data. A test-only fourth provider can participate through registration without changing the aggregation algorithm. UI extension proof follows in Phase 9.

### Phase 6 — Configure source combinations at runtime

**Status:** Complete locally; see [validation and React walkthrough](phase-06-source-configuration.md).

**Purpose:** Meet the requirement to change combinations of existing sources without changing application code.

**Work:** Load `public/source-config.json`, validate provider IDs and settings, and enable only the configured providers. Show a useful configuration error for unknown or duplicate IDs. Treat an empty enabled set as a valid configuration.

**Deliverable:** Runtime configuration controls which source groups are available.

**Done when:** Tests cover all eight combinations of the three providers. Editing configuration and reloading changes the enabled groups without TypeScript edits or rebuilding. Invalid configuration does not silently enable defaults.

### Phase 7 — Implement isolated mapping state

**Status:** Complete locally; see [validation and React walkthrough](phase-07-mapping-state.md).

**Purpose:** Make mapping changes predictable and keep one form's edits from affecting another.

**Work:** Add reducer actions to set, replace, and clear a mapping. Key state by blueprint, target node, and target field; store stable source references. Keep state in memory and document that a reload resets it.

**Deliverable:** A tested mapping model, ready to connect to the UI.

**Done when:** Tests prove changes are isolated across fields, nodes sharing a definition, and blueprints. Clearing an unmapped field is safe, and replacing a mapping affects only its intended target.

### Phase 8 — Build the basic source-selection flow

**Status:** Complete locally; see [validation and React walkthrough](phase-08-prefill-dialog.md).

**Purpose:** Complete the central user task: choose a field and assign a source.

**Work:** Render mapped and unmapped field rows. Open a dialog from a field, show source groups and options, preview the draft selection, and commit only through Select. Add replace and clear actions. Implement dialog naming, initial focus, focus containment, Escape, and focus return as part of the first dialog version.

**Deliverable:** Users can add, replace, and remove a mapping from the form editor.

**Done when:** Interaction tests map D.email from A.email, revisit the form, replace the source, and clear it. Select is disabled without a valid choice. Cancel and Escape leave state unchanged; switching the target cannot commit a draft to another field.

### Phase 9 — Add search and source failure handling

**Status:** Complete locally; see [validation and React walkthrough](phase-09-source-search.md).

**Purpose:** Keep source selection usable when catalogs grow or a provider is slow or unavailable.

**Work:** Add group expansion, case-insensitive search over group and field labels, and empty-result feedback. Display loading and provider-specific errors. Cancel or ignore stale requests, revalidate choices before commit, and label existing references from disabled providers as unavailable while allowing clearing.

**Deliverable:** A searchable dialog that handles partial failures without losing valid choices.

**Done when:** Tests cover no matches, no enabled sources, one failed provider, delayed responses after changing target, and a disabled source used by an existing mapping. The test-only fourth provider renders and can be selected without provider-specific UI edits.

### Phase 10 — Polish the editor and keyboard flow

**Status:** Complete locally; see [validation and React walkthrough](phase-10-editor-polish.md).

**Purpose:** Make the completed behavior clear and comfortable on desktop, narrow screens, and keyboards.

**Work:** Finish the responsive list/detail layout, mapped counts, readable field keys and labels, and accessible clear controls. Check focus behavior across replacement, clearing, and empty results. If keeping the screenshot's prefill toggle, make it disable editing while preserving mappings, with a clear disabled state.

**Deliverable:** A consistent editor with explicit state feedback and no hidden essential actions.

**Done when:** Manual keyboard and viewport checks pass, focus remains predictable, and all controls have useful accessible names. If the toggle is included, tests prove disabling and reenabling preserve mappings. Capture review screenshots.

### Phase 11 — Verify the complete app against the mock

**Status:** Complete locally; see [validation and test architecture](phase-11-acceptance.md).

**Purpose:** Prove that individually tested pieces work together with the actual server.

**Work:** Run a small browser scenario against the mock: load forms, select D, map its email from A, switch away and back, replace, and clear. Check a configured source subset, server failure/retry, keyboard dialog operation, and a narrow viewport. Run type checking, the full test suite, and production build.

**Deliverable:** A concise validation record distinguishing automated tests, real browser observations, and limitations.

**Done when:** The main browser flow and required local checks pass. Record commands, mock revision, results, and screenshots. Reload behavior is visibly consistent with session-only state; no server-save claim is made.

### Phase 12 — Finish documentation and prepare the handoff

**Status:** Implemented; see [handoff and validation](phase-12-handoff.md).

**Purpose:** Make the project easy for a reviewer to run, understand, and extend during the live session.

**Work:** Finish README setup and verification commands. Document provider configuration and a complete new-provider example with registration and tests. Explain graph direction, node identity, field policy, persistence limits, and AI assistance. Prepare a short demonstration and inspect the final diff.

**Deliverable:** A review-ready independent codebase with setup, architecture, extension, and validation documentation.

**Done when:** A clean checkout can follow the README successfully. The extension example matches the final implementation. The handoff lists limitations and evidence, with no unsupported completion claims. GitHub publication and submission remain separate later actions.

## 5. Suggested four-business-day allocation

The challenge's receipt date must be established before assigning calendar deadlines. This is a suggested allocation, not a completion promise. Keep each phase separate even when several fit within one day.

| Relative day | Phases | Main outcome |
| --- | --- | --- |
| 1 | 1–4 | Fresh app, real API connection, form list, tested dependency traversal |
| 2 | 5–8 | Configurable providers, isolated state, working mapping flow |
| 3 | 9–11 | Search, failure handling, accessibility, real browser validation |
| 4 | 12 and buffer | Clean-checkout verification, documentation, handoff |

If time is tight, reduce decoration and optional toggle polish before reducing identity, traversal, isolation, accessibility, or provider-configuration coverage.

## 6. Review checklist and next action

- [x] Fresh codebase; no Claude source reused or modified.
- [x] Mock revision pinned and API documentation revisited; the documentation URL remains inaccessible.
- [x] Node identity remains separate from form-definition identity.
- [x] Direct and indirect upstream form queries are correct and deduplicated; source-provider UI is implemented.
- [x] Provider combinations change through runtime configuration; catalog combinations are tested and deployed JSON reload is browser-verified.
- [x] A registered fourth provider renders and can be selected without modal changes.
- [x] Mapping set/replace/clear/cancel and form isolation are tested.
- [x] Loading, error, empty, unavailable, and keyboard flows are covered.
- [x] Local checks and actual browser evidence are reported separately.
- [x] README supports fresh setup and a live extension demonstration.

Next action: review the delivery-correction PR targeting main directly, merge after its checks pass, and submit the repository link. There is no planned Phase 13. See [handoff](handoff.md) for remaining limitations.
