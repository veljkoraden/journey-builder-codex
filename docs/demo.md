# Five-minute reviewer demonstration

Run the two-terminal setup in the [README](../README.md). Use a disposable checkout
for configuration edits and restore its JSON afterward. No backend save occurs.

1. **Forms and identity:** Select D. Explain A → B → D: B is direct, A is indirect.
   Nodes sharing a form definition still have independent mappings.
2. **Confirmed mapping:** Open Email, search `email`, choose A.Email, and Select.
   Point out the count. Switch to E and back: D's mapping remains.
3. **Draft versus saved state:** Open the mapping, choose B.Email, and Cancel or
   Escape. A.Email remains. Repeat and Select to replace it; Clear removes it.
4. **Keyboard and toggle:** Open with Enter, navigate with Tab, cancel with Escape.
   Toggle prefill off with Space; editing stops but mappings/counts remain. Reenable.
5. **Runtime configuration:** Remove `indirect-forms` from the runtime JSON while
   D has an A mapping. Press Refresh source settings. The reference becomes
   unavailable without being deleted. Reenable it and refresh. No code rebuild.
6. **Reload semantics:** Reload the page. Mappings and toggles reset. Explicitly
   state that the mock does not support persistence.
7. **Extension:** Show the actual team-directory module and its tests. Follow
   [provider extension](provider-extension.md) to register it and select Manager
   email without changing the UI. Distinguish adding code from enabling installed
   providers through JSON.

For server failure/retry and invalid data, run `npm run test:e2e` instead of
stopping someone else's running server. Its isolated scenarios exercise those
paths and attach screenshots. Open `npm run test:e2e:report` to review results.

Explain the code in this order: `main.tsx` → `App.tsx` → blueprint boundary →
graph service → provider registry/configuration → editor state → dialog draft.
Point out the settings/registry extension point and why node IDs differ from
form-definition IDs. Finish with the [known limitations](handoff.md).
