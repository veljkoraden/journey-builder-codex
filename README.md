# Journey Builder Codex

An independent React + TypeScript implementation of the Avantos Journey Builder
challenge. Browse forms, map a field from direct/indirect upstream forms or sample
global properties, search sources, replace or clear mappings, and inspect source
availability. Forms are sorted alphabetically, ignoring capitalization. Source
group headers show Direct/Transitive badges beside form names. Each form has a mapped-field count and a switch that pauses editing
without deleting its mappings.

**Edits are session-only.** Reloading resets mappings and editing switches. The
mock has no save endpoint; this app configures references, not submitted values.

## Run locally

Use Node **22.18+ within the Node 22 release line** and npm 10. `.nvmrc` pins the
project's development version; use `nvm use` if you use nvm. Node 22.18 is
the minimum required by the lint parser; `.nvmrc` remains at 22.22.2.

```sh
npm ci
```

In one terminal, from this repository, start the bundled pinned official mock:

```sh
node e2e/mock/index.cjs
```

In a second terminal, from this repository:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. The mock uses port 3000. If a port is occupied,
inspect the listener and use a different port for your own process; do not stop
an unrelated service. The app port can be changed with
`npm run dev -- --port 5174`. To change the mock port, use a separate local copy
of its server/graph, adjust that copy's listen port, and set `VITE_API_BASE_URL`.
Leave the checksummed acceptance fixture unchanged.

The bundled files are attributed to the [official mock](e2e/mock/README.md), pinned
at `fdfbb9c78eb8ac518f952be183a3718098005265`. They use Node built-ins; no separate
mock package installation is needed.

## Try the editor

1. Select **Form D**, then **Choose prefill source** on Email.
2. Select Email in **Form A**, inspect the preview, and press **Select**.
3. Switch to another form and back; the mapping remains.
4. Click the mapped source to replace it, or **Clear** to remove it.
5. Cancel/Escape discard drafts. The prefill switch pauses editing for one form
   while preserving mappings. Search matches group/field labels.

See the [five-minute demonstration](docs/demo.md) for configuration changes,
unavailable-source recovery, keyboard checks, and an extension demonstration.

## Configuration

| Configuration | Where | When applied |
| --- | --- | --- |
| API URL, tenant, blueprint | `.env` / `VITE_*` | Restart development server or rebuild |
| Enabled source providers/settings | `public/source-config.json` | Refresh source settings or reload |
| Deployed provider configuration | Served `source-config.json` beside `index.html` | Refresh source settings or reload, no JS rebuild |

Copy `.env.example` to `.env` for API overrides. Defaults are
`http://localhost:3000`, tenant `1`, and blueprint
`bp_01jk766tckfwx84xjcxazggzyc`. The client uses the mock's route:
`/api/v1/{tenant}/actions/blueprints/{blueprint}/graph`.
The challenge's linked versioned route was not available in this mock.

Example source configuration:

```json
{
  "providers": [
    { "id": "direct-forms", "enabled": true },
    { "id": "indirect-forms", "enabled": false },
    { "id": "global-properties", "enabled": true }
  ]
}
```

Omitted/disabled providers are excluded; an empty list enables none. IDs must be
known and unique, including disabled entries. Built-ins accept no settings.
Configuration errors are visible; the app never silently enables defaults.
**Refresh source settings** preserves session edits, unlike page reload.
All browser configuration is public: never put secrets in JSON or `VITE_*`.

Adding a genuinely new provider requires code and a build. Choosing a combination
of installed providers does not. Follow the [tested extension guide](docs/provider-extension.md).

## Validate

```sh
npm run format:check
npm run lint
npm run test:run
npm run build
npx playwright install chromium
npm run test:e2e
```

The shipped JSON is validated without requiring a fixed enabled subset. Browser
scenarios set their own configuration, including all eight built-in combinations.

The acceptance suite builds this checkout and starts its own isolated mock and
app servers on available loopback ports. It needs no running dev server or `.env`.
On Linux missing browser libraries, use
`npx playwright install --with-deps chromium` (may need administrator rights).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run format` / `npm run format:check` | Format / check owned TypeScript and CSS |
| `npm run lint` | Check Rules of Hooks and effect dependencies |
| `npm run typecheck` | Check application and unit/component tests |
| `npm test` / `npm run test:run` | Watch / run Vitest once |
| `npm run build` / `npm run preview` | Build / serve `dist` |
| `npm run typecheck:e2e` | Check browser harness TypeScript |
| `npm run test:e2e` | Typecheck, build isolated app, run Chromium acceptance |
| `npm run test:e2e:report` | Open browser HTML report |

CI runs these checks and uploads browser artifacts. Local results, PR checks,
merge, deployment, and submission are separate milestones. See the
[handoff and evidence](docs/handoff.md) for current coverage and limitations.

## Optimization progress

[Issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16) tracks
readability and extensibility improvements. [O1: readability and tooling](docs/optimization-o1-readability.md)
documents the first increment and its React walkthrough.
[O2: shared catalog decisions](docs/optimization-o2-catalog-decisions.md) centralizes
lookup, labels, search, and mapping availability.
[O3: editor composition](docs/optimization-o3-editor-composition.md) separates selected-form
presentation and creates stable contexts near their consumers. Runtime provider
configuration remains unchanged. [O4: mapping state and request evaluation](docs/optimization-o4-state-and-requests.md)
stores fallback labels with mappings and documents why caching and a generic async
hook are deferred. O5 will verify and simplify the provider-extension walkthrough.

Formatting applies to owned source/tests, CSS, browser harness TypeScript, and
root TypeScript/JavaScript configuration. It excludes Markdown, JSON, generated
reports, and the checksummed upstream mock. ESLint uses Babel for syntax parsing;
`tsc` still owns type checking. The lint rules follow the
[React Hooks guidance](https://react.dev/reference/eslint-plugin-react-hooks).

## Understand and extend the code

- [Architecture and React walkthrough](docs/architecture.md): file tree, startup,
  props, state, reducers, effects, graph/model boundaries.
- [Provider extension](docs/provider-extension.md): runtime combinations and a
  real, tested `team-directory` example, intentionally not enabled by default.
- [Demonstration](docs/demo.md): normal flow, failure feedback, and live explanation.
- [Handoff](docs/handoff.md): acceptance scope, limitations, review order, AI use.
- [Phase 12](docs/phase-12-handoff.md): final-phase changes and validation.
- [Implementation plan](docs/implementation-plan.md): all twelve phases and
  historical evidence links.

The implementation was developed with AI assistance from OpenAI Codex. It was
built independently; no Claude application source was copied or imported. A
later user-authorized read-only comparison informed architectural discussion.
The submitter should review and understand the code before the live exercise.
