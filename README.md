# Journey Builder Codex

An independent React implementation of the Avantos Journey Builder challenge.
Phase 1 provides the application shell and development tooling. API fetching,
forms, source providers, and prefill editing follow in later phases.

## Run locally

Use Node.js 22.12 or newer within the Node 22 release line and npm 10.
The development environment uses Node 22.22.2 (`nvm use` reads `.nvmrc`).

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The port is fixed: stop a conflicting process or
explicitly supply another port with `npm run dev -- --port 5174`.
The shell works without a mock server or an `.env` file.

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
semantic landmarks, the initial workspace message, keyboard access to the skip
link, and StrictMode rendering. DOM tests do not prove browser layout or native
fragment navigation. Add tests for each later phase alongside its implementation.

## Structure

- `src/app/`: application composition and its tests.
- `src/main.tsx`: React entry point.
- `src/index.css`: shared styling.
- `src/test/setup.ts`: DOM matchers and per-test cleanup.
- `docs/implementation-plan.md`: twelve-phase delivery plan.
- `docs/phase-01-foundation.md`: scope, decisions, validation, and deferrals.

## Configuration and scope

`.env.example` reserves public settings for the Phase 2 mock API connection.
They are not read by Phase 1. When API integration is added, copy it to `.env`
and adjust the values. Never put secrets in `VITE_*` settings: Vite exposes them
to the browser. Environment files and generated output are ignored by Git.

Data fetching, graph traversal, mappings, persistence, and provider registration
are not implemented yet. The planned provider contract and extension approach
are described in the implementation plan; executable extension examples will
arrive with those phases. No Claude application source was reused.

This increment was implemented with AI assistance; its behavior and limitations
are documented for review and further development.
