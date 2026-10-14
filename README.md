# Journey Builder Codex

An independent React implementation of the Avantos Journey Builder challenge.
Phases 1–4 provide the application shell, mock API connection, response and dependency
validation, upstream queries, and a selectable form/field browser. Source providers and prefill editing follow later.

## Run locally

Use Node.js 22.12 or newer within the Node 22 release line and npm 10.
The development environment uses Node 22.22.2 (`nvm use` reads `.nvmrc`).

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The port is fixed: stop a conflicting process or
explicitly supply another port with `npm run dev -- --port 5174`.
Without an `.env` file, the app requests the documented local mock defaults.
Start the mock in a separate terminal:

```bash
git clone https://github.com/mosaic-avantos/frontendchallengeserver.git
cd frontendchallengeserver
git checkout fdfbb9c78eb8ac518f952be183a3718098005265
npm start
```

This revision uses Node's built-in HTTP module and needs no dependency install.
It listens on port 3000. If that port is occupied, stop your own conflicting
service or change the mock's local listen port and set `VITE_API_BASE_URL` to match.
Do not terminate an unrelated service. The app displays loading, a selectable form
list, or a retryable error. It validates the data needed for browsing before rendering;
cycles, missing references, and prerequisite disagreement block browsing. Complete
JSON Schema evaluation is not implemented.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Check source, tests, and Vite configuration without emitting files |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run the full test suite once |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the build at http://127.0.0.1:4173 |

Tests use jsdom, React Testing Library, user-event, and jest-dom. They check
configuration validation, HTTP and JSON failures, cancellation, stale responses,
request lifecycle, response normalization, shared definitions, malformed data,
field policy, dependency integrity/traversal, semantic landmarks, keyboard
selection/retry, and StrictMode rendering.
DOM tests do not prove browser layout or native fragment navigation. Add tests for each later phase alongside its implementation.

## Structure

- `src/app/`: application composition and its tests.
- `src/blueprint/`: endpoint/client, normalized model, validation, field policy, request hook, and connection view.
- `src/dependencies/`: pure graph validation, predecessor indexing, and upstream queries.
- `src/ui/`: form browser, selection list, and field details.
- `src/test/blueprintFixture.ts`: independently authored test data.
- `src/main.tsx`: React entry point.
- `src/index.css`: shared styling.
- `src/test/setup.ts`: DOM matchers and per-test cleanup.
- `docs/implementation-plan.md`: twelve-phase delivery plan.
- `docs/phase-01-foundation.md`: foundation evidence.
- `docs/phase-02-api-connection.md`: API scope, tests, mock revision, and browser evidence.
- `docs/phase-03-form-browser.md`: validation/form browsing, test evidence, and beginner React walkthrough.
- `docs/phase-04-dependencies.md`: dependency policy, algorithm tests, and React integration walkthrough.

## Configuration and scope

Copy `.env.example` to `.env` to override the public API settings, then restart Vite:

| Setting | Default |
| --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000` |
| `VITE_TENANT_ID` | `1` |
| `VITE_BLUEPRINT_ID` | `bp_01jk766tckfwx84xjcxazggzyc` |

The client appends `/api/v1/{tenant}/actions/blueprints/{blueprint}/graph` to the
base URL. Base path prefixes are supported; query strings, fragments, credentials,
non-HTTP URLs, and empty identifiers are rejected. Identifiers are URL-encoded.
Vite settings are public build-time values, not the future runtime provider config.
Never put secrets in `VITE_*` variables. Environment files and build output are ignored.

Fetching is cancelled when the view unmounts or the endpoint changes. Old requests
cannot overwrite newer results. Network, HTTP, and unreadable JSON errors provide
a retry action. Configuration errors require fixing the settings and restarting
Vite. No automatic retry loop, timeout, persistence, or mapping writes are added.

The browser preserves node identity even when definitions are shared, shows field
labels/keys/types/required markers, and excludes button controls from prefill targets.
Arrays and objects remain visible. Forms and fields preserve API/schema order.

`loadBlueprint` fetches, normalizes, and validates dependencies before the hook
publishes success. Its `dependencies.getAncestors(nodeId)` and
`dependencies.getUpstreamForms(nodeId)` methods return disjoint direct/indirect
groups. Edges are authoritative; supplied prerequisites must agree. Duplicate
relationships are deduplicated, while duplicate identities and cycles are rejected.
Non-form intermediary nodes are traversed but not returned as form sources.

Mappings and provider registration are not implemented yet. See the Phase 3 and
Phase 4 documents for validation boundaries. The provider contract is planned;
executable provider examples arrive in later phases. No Claude source was reused.

This increment was implemented with AI assistance; its behavior and limitations
are documented for review and further development.
