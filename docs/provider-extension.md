# Extend prefill sources

## Change existing combinations without code changes

Edit `public/source-config.json` during development or the served
`source-config.json` after deployment. Use **Refresh source settings** to apply
it without losing mappings; page reload also applies it but resets session state.
Changing the source file in a checkout does not change an already-deployed copy.

The parser validates all entries, including disabled providers. Omitted IDs are
disabled; `{"providers": []}` is valid. IDs must be registered and unique.
Built-ins accept no settings. Configuration is public, not a secret store.

## Choose the smallest change

| Goal | Edit | Rebuild JavaScript? |
| --- | --- | --- |
| Enable any subset of installed providers | Served `source-config.json` | No |
| Change supported settings of an installed provider | Served `source-config.json` | No |
| Add new provider behavior | Provider module, registry import/registration, JSON entry | Yes |

For example, this enables only transitive forms and global data:

```json
{
  "providers": [
    { "id": "indirect-forms", "enabled": true },
    { "id": "global-properties", "enabled": true }
  ]
}
```

The three installed IDs are `direct-forms`, `indirect-forms`, and
`global-properties`. Any of their eight subsets is valid, including none.
Do not add UI switches on these IDs. The registry supplies implementations;
the runtime JSON chooses which installed implementations participate.

## Contract

Implement `SourceProvider` from `src/sources/model.ts`:

- `id`: stable namespace.
- `validateSettings(settings: unknown)`: required if the provider accepts settings;
  reject malformed or unsupported values. It is optional for no-settings providers.
- `getGroups(context, settings, signal)`: async catalog generation. Validate settings
  here too because direct callers can bypass the configuration loader. Honor abort.

Context contains the normalized blueprint, its dependency service, target form,
and target field. Return groups with unique IDs within the provider, labels,
optional descriptions, and options. References must be unique across all of that
provider's groups and use its provider ID, stable resource ID, and path segments.
Form references use node IDs, never definition IDs. Labels can change freely.

The shared aggregator validates identities and isolates failures. It does not
validate arbitrary remote payloads for you. A remote provider should fetch with
the supplied signal, check status/JSON, validate its response, and translate it
into this contract. Do not put remote-specific branching in the dialog.

## Executable example: team directory

The actual example is [teamDirectory.ts](../src/sources/examples/teamDirectory.ts),
with [tests](../src/sources/examples/teamDirectory.test.tsx). It offers Manager
email and Team name references for a configured team. It does not fetch real team
values and is intentionally absent from the default registry and bundle imports.

Use Node 22.18 or later within Node 22 (see `.nvmrc`). From the repository root,
run `npm ci` first if dependencies are not installed. Keep the mock server running
as described in [the README](../README.md) for the manual UI steps; unit tests and
builds do not need that server.

### 1. Read and test the example

First run its tests:

```sh
npm run test:run -- src/sources/examples/teamDirectory.test.tsx
```

### 2. Register the implementation once

To enable the example, edit `src/sources/registry.ts`:

```ts
import { teamDirectory } from "./examples/teamDirectory";

// Replace the existing sourceRegistry declaration; retain the other registry code.
export const sourceRegistry = createSourceRegistry([
  directForms,
  indirectForms,
  globalProperties,
  teamDirectory,
]);
```

### 3. Enable it through runtime configuration

Then append this entry to the `providers` array in `public/source-config.json`:

```json
{
  "id": "team-directory",
  "enabled": true,
  "settings": {
    "teamId": "onboarding",
    "teamLabel": "Onboarding team"
  }
}
```

The shipped-configuration test validates the JSON without fixing its enabled
subset. No test edits are needed when changing combinations or registering this
example. Browser scenarios explicitly configure their own source combinations.

### 4. Validate and try the unchanged editor

Run these checks without editing test expectations:

```sh
npm run test:run
npm run build
```

Start `npm run dev`, or deploy the new build. Refresh source settings and open a field. Search for **Manager**, select
**Manager email**, and confirm. The mapping uses:

```json
{
  "providerId": "team-directory",
  "resourceId": "onboarding",
  "fieldPath": ["manager_email"]
}
```

No modal, reducer, field component, or dependency-traversal changes are needed.
Registering new code needs a build. Later changing `enabled` or `teamLabel` in the
served JSON does not. Changing `teamId` changes resource identity and makes old
references unavailable; changing only `teamLabel` preserves identity.

### 5. Verify settings and unavailable mappings

For the demonstration, disable the provider and refresh settings. Its existing
mapping remains stored, is marked unavailable, and can be cleared. Remove the
registration/config entry afterward if you want the original three-source app.

## Local catalogs and future remote providers

`teamDirectory.getGroups` is `async` even though its catalog is computed locally.
JavaScript wraps its returned array in a Promise. The uniform contract lets the
aggregator handle local and remote providers identically; it does not mean every
provider must make an HTTP request. Catalog options describe references, not the
actual values of submitted forms or team records.

For a remote implementation, keep fetching and response validation inside the
provider. Pass the supplied signal to `fetch`, check `response.ok`, validate JSON
before constructing groups, and let errors reject the Promise so the aggregator
can isolate that provider's failure. Recheck cancellation after lengthy work.
Do not embed credentials in public configuration or `VITE_*` variables. A remote
service needs its own authentication boundary; this example does not implement it.

Providers may use both the target form and target field. Do not assume catalogs
can be shared by form ID alone. See [O4's measured request decisions](optimization-o4-state-and-requests.md).

## What the example tests prove

Tests exercise the actual module, not a copied documentation snippet:

- strict settings validation through both configuration and direct calls;
- unknown keys, missing/empty/wrong-type values, and disabled-entry validation;
- stable references when labels change and distinct resources when IDs change;
- root-form options without upstream dependencies and cancellation;
- registry → configuration → aggregator integration;
- search, selection, mapping, and clearing through the unchanged React editor;
- label refresh, disable/re-enable preservation, and a changed team ID becoming
  unavailable without deleting its saved mapping.

The registration test verifies that configuration cannot enable unregistered code. Existing
browser acceptance keeps proving the three built-in providers' eight combinations.
