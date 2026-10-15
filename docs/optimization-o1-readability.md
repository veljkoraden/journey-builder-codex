# Optimization O1 — Readability and consistency

Tracking: [issue #16](https://github.com/veljkoraden/journey-builder-codex/issues/16).
Scope: the first optimization phase, not a new product feature. Based on main
`8ba5b7d`; shared catalog/search decisions remain O2 work.

## What changed

The editor, mapping controls, and source dialog now declare named props interfaces.
Substantial JSX callbacks became named functions: `setFormEditing`, `openField`,
`confirmSource`, `clearAndRestoreFocus`, `cancelSelection`, `handleDialogKeyDown`,
`retrySources`, and `confirmSelection`. Names such as `activeTarget`,
`currentTarget`, `sourceLabels`, and `selectedSourceKey` explain what state holds.
Mapping availability now reads as ordered early-return conditions instead of a
nested ternary. These functions remain local to their owning components.

A separate mechanical commit formats owned application/test TypeScript and CSS,
browser harness TypeScript, and root code configuration. The subsequent commit
contains the semantic readability edits and tooling. Formatting does not touch
the pinned upstream mock, Markdown, JSON, or generated output.

No provider ID, configuration contract, dependency algorithm, mapping identity,
state owner, or context lifecycle is changed. The all-form context map and
repeated catalog/search processing intentionally remain for later phases.

## Files and responsibilities

| Files | Responsibility in this phase |
| --- | --- |
| `src/ui/PrefillEditor.tsx` | Named props and handlers for form editing and confirmed mapping updates |
| `src/ui/MappingControls.tsx` | Readable availability conditions, button label, and clear/focus handler |
| `src/ui/SourceDialog.tsx` | Named keyboard/cancel/retry/confirm handlers and explicit selection state name |
| Owned `src/` files and `e2e/*.ts` | Mechanical formatting, including existing tests |
| `eslint.config.mjs` | TypeScript/TSX parsing and the two fundamental Hooks rules |
| `.prettierrc.json` | Shared formatting policy |
| `package.json`, `package-lock.json` | Pinned development tools and format/lint commands |
| `.github/workflows/validate.yml` | Run formatting and Hooks checks before tests/build/browser acceptance |
| `README.md`, this document | Current commands, runtime requirement, phase scope, and walkthrough |

## React walkthrough: which file runs first?

```text
index.html
  → src/main.tsx
    → src/app/App.tsx
      ├── useSourceConfiguration → configuration loader → runtime JSON/registry
      ├── SourceConfigurationStatus
      └── BlueprintConnection
          → useBlueprint → loadBlueprint → client → normalizeBlueprint
            → createDependencyGraph
          → PrefillEditor
              ├── usePrefillMappings → mappingReducer
              ├── FormBrowser → FormList
              │               → FormFields → MappingControls
              └── SourceDialog → useSourceCatalog → loadSourceCatalog → providers
                                → SourceGroupChoices
```

The HTML loads `main.tsx`. `createRoot` mounts `App` under `StrictMode`. React
renders components, then effects start configuration and blueprint requests.
When request state changes, React renders the loading, error, or ready view.
Configuration and blueprint loading are independent.

A props interface describes the inputs a component accepts; it is a compile-time
contract, not another object created at runtime. Named handlers are ordinary
functions passed to buttons or inputs. Moving them above JSX makes the render
section easier to read without changing when the user action happens.

`PrefillEditor` owns saved mappings and editing switches above form selection, so
switching forms preserves edits. Clicking a field calls `openField` and renders
`SourceDialog`. The dialog's `selectedSourceKey` is only a draft: choosing an
option updates dialog state. `confirmSelection` passes the source to the editor's
`confirmSource`, which dispatches a mapping update and closes the dialog. Cancel
closes the dialog without dispatching a mapping update.

`MappingControls` checks source availability and renders the saved mapping. Its
clear handler still restores focus as before. The modal keeps native dialog
behavior, Escape/cancel handling, keyboard containment, and return focus.
Imports define modules; they do not automatically fetch provider options.

## Tooling and compatibility

- `npm run format`: format owned code.
- `npm run format:check`: check without writing.
- `npm run lint`: enforce `react-hooks/rules-of-hooks` and
  `react-hooks/exhaustive-deps`, with no warnings allowed.
- `npm run typecheck`: retain strict TypeScript compilation as a separate check.

ESLint uses Babel's TypeScript/JSX syntax parser, without transformation or type
checking. The current TypeScript ESLint parser does not declare support for the
project's TypeScript 7 compiler, so it is not installed. The Babel parser does not
replace `tsc`. Only the two established Hooks rules are enabled; this phase does
not adopt a compiler-wide lint preset or change effect lifecycle behavior.

The supported pinned ESLint/Babel toolchain requires **Node 22.18+ within Node 22**.
This raises the previous documented 22.12 minimum. `.nvmrc` remains 22.22.2, and
CI selects Node 22. Dependencies are development-only; no runtime library is added.
See [React's Hooks lint documentation](https://react.dev/reference/eslint-plugin-react-hooks).

## Validation evidence

Validated on 2026-10-15 from a fresh worktree and locked `npm ci` installation:

- `npm run format:check`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run test:run`: all 319 tests across 19 files passed.
- `npm run build`: strict TypeScript and production build passed.
- `npm run test:e2e`: application/harness typechecks and all 16 Chromium scenarios
  passed against the pinned official mock over real HTTP, including all eight
  runtime combinations with unchanged JavaScript assets.
- An in-memory lint probe confirmed that conditional Hooks and missing effect
  dependencies both produce errors; no probe file was added to the application.
- 61 relative documentation links resolve; `git diff --check` passed.

Existing behavior tests are the regression gate; no tests that merely mirror
renamed functions were added. Local results do not claim GitHub CI or merge status;
check the phase PR for those results.

## Extensibility and remaining work

All eight combinations of direct/transitive/global sources must continue to work
through runtime JSON without rebuilding JavaScript. Existing fourth-provider
interaction/example tests retain the extension proof. New provider code still
requires implementation, registration, and a build. UI components remain generic.

O2 will centralize catalog/search decisions and explicitly model availability.
O3 will address selected-form composition and context construction. Label-state
ownership, request caching, and common asynchronous hooks are deferred evaluations,
not part of this change. Session-only mappings and Chromium-only browser coverage
remain limitations. No merge, deployment, or submission is performed automatically.
