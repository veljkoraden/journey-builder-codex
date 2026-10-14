import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { dependencyFixture } from "../test/dependencyFixture";
import { createDependencyGraph } from "../dependencies/createDependencyGraph";
import { createSourceRegistry } from "../sources/registry";
import type { SourceGroup, SourceProvider } from "../sources/model";
import { PrefillEditor } from "./PrefillEditor";

beforeEach(() => {
  // jsdom has no top-layer modal implementation; real focus/inert behavior is browser-verified separately.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
function setup() {
  const original = dependencyFixture();
  const blueprint = { ...original, forms: original.forms.map((form) => ({ ...form, fields: [
    { key: "email", label: "Email", types: ["string"], controlType: null, required: false },
    { key: "name", label: "Name", types: ["string"], controlType: null, required: false },
  ] })) };
  return { blueprint, dependencies: createDependencyGraph(blueprint),
    selections: ["direct-forms", "indirect-forms", "global-properties"].map((id) => ({ id })) };
}
async function openD(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Form D" }));
  await user.click(screen.getByRole("button", { name: "Set prefill for Email" }));
  return screen.findByRole("dialog");
}
async function choose(user: ReturnType<typeof userEvent.setup>, group = "Form A", label = "Email") {
  const fieldset = await screen.findByRole("group", { name: group });
  await user.click(within(fieldset).getByRole("button", { name: label }));
}
const customGroup: SourceGroup = { id: "extra", label: "Extra source", options: [{
  label: "Custom email", types: ["string"], reference: { providerId: "extra", resourceId: "resource", fieldPath: ["email"] },
}] };

describe("prefill editor interactions", () => {
  it("maps D.email from A, preserves it across navigation, replaces it with B and clears it", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user);
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
    await choose(user);
    expect(screen.getByText("Selected: Form A · Email")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
    await user.click(screen.getByRole("button", { name: "Form E" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Form D" }));
    await user.click(screen.getByRole("button", { name: "Replace prefill for Email" }));
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
    await choose(user, "Form B");
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form B · Email");
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Clear prefill for Email" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toHaveFocus();
  });
  it.each(["Cancel", "Escape", "native cancel"])("discards a draft via %s and restores trigger focus", async (method) => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    const dialog = await openD(user);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await choose(user);
    if (method === "Cancel") await user.click(screen.getByRole("button", { name: "Cancel" }));
    else if (method === "Escape") await user.keyboard("{Escape}");
    else fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear prefill for Email" })).not.toBeInTheDocument();
  });
  it("cancels replacement without changing the existing mapping", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Replace prefill for Email" }));
    await choose(user, "Form B"); await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
  });
  it("keeps keyboard focus inside the dialog", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    const first = screen.getByRole("searchbox");
    const last = screen.getByRole("button", { name: "Select" });
    last.focus(); await user.tab(); expect(first).toHaveFocus();
    await user.tab({ shift: true }); expect(last).toHaveFocus();
  });
  it("offers globals for a root and supports an empty configured set", async () => {
    const props = setup(); const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} />);
    await user.click(screen.getByRole("button", { name: "Set prefill for Email" }));
    await choose(user, "Sample organization", "Support email");
    expect(screen.queryByRole("group", { name: "Form A" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));
    rerender(<PrefillEditor {...props} selections={[]} />);
    await user.click(screen.getByRole("button", { name: "Replace prefill for Email" }));
    expect(await screen.findByText("No sources available for this field.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });
  it("blocks editing while configuration is unavailable", () => {
    render(<PrefillEditor {...setup()} selections={undefined} />);
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeDisabled();
  });
  it("discards drafts when configuration changes", async () => {
    const props = setup(); const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} />);
    await openD(user); await choose(user);
    rerender(<PrefillEditor {...props} selections={undefined} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace prefill for Email" })).not.toBeInTheDocument();
    rerender(<PrefillEditor {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("closes the draft when target form changes without mapping the new form", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    // Simulates an external selection change; native browser modality blocks pointer access behind the dialog.
    fireEvent.click(screen.getByRole("button", { name: "Form E" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Form D" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
  });
  it("closes an obsolete blueprint draft", async () => {
    const props = setup(); const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} />);
    await openD(user); await choose(user);
    const next = setup(); rerender(<PrefillEditor {...next} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
  });
  it("isolates mappings between fields", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Set prefill for Name" }));
    await choose(user, "Form B", "Name");
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Name" })).toHaveTextContent("Form B · Name");
  });
  it("resets on unmount and remount", async () => {
    const user = userEvent.setup(); const first = render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    await user.click(screen.getByRole("button", { name: "Select" }));
    first.unmount(); render(<PrefillEditor {...setup()} />);
    await user.click(screen.getByRole("button", { name: "Form D" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
  });
  it("works under StrictMode", async () => {
    const user = userEvent.setup(); render(<StrictMode><PrefillEditor {...setup()} /></StrictMode>);
    await openD(user); await choose(user);
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
  });
  it("renders and maps a registered fourth provider without UI branching", async () => {
    const registry = createSourceRegistry([{ id: "extra", getGroups: async () => [customGroup] }]);
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} registry={registry} selections={[{ id: "extra" }]} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Extra source · Custom email");
  });
  it.each(["resolve", "reject"])("ignores late provider %s after cancellation", async (outcome) => {
    let resolve!: (groups: readonly SourceGroup[]) => void;
    let reject!: (error: unknown) => void;
    let signal!: AbortSignal;
    const provider: SourceProvider = { id: "extra", getGroups: (_ctx, _settings, abortSignal) => {
      signal = abortSignal;
      return new Promise((yes, no) => { resolve = yes; reject = no; });
    } };
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} registry={createSourceRegistry([provider])} selections={[{ id: "extra" }]} />);
    await openD(user);
    expect(screen.getByRole("status")).toHaveTextContent("Loading sources");
    await waitFor(() => expect(signal).toBeDefined());
    await user.keyboard("{Escape}"); expect(signal.aborted).toBe(true);
    await act(async () => { if (outcome === "resolve") resolve([customGroup]); else reject(new Error("late")); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
  });
  it("keeps successful options when another provider fails", async () => {
    const registry = createSourceRegistry([
      { id: "extra", getGroups: async () => [customGroup] },
      { id: "broken", getGroups: async () => { throw new Error("Unavailable"); } },
    ]);
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} registry={registry} selections={[{ id: "broken" }, { id: "extra" }]} />);
    await openD(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Some sources could not be loaded");
    await choose(user, "Extra source", "Custom email");
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
  });
  it("cannot confirm a source after the registry removes it", async () => {
    const props = setup();
    const selections = [{ id: "extra" }];
    const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} selections={selections}
      registry={createSourceRegistry([{ id: "extra", getGroups: async () => [customGroup] }])} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
    rerender(<PrefillEditor {...props} selections={selections} registry={createSourceRegistry([])} />);
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown source provider");
    expect(screen.queryByText("Selected: Extra source · Custom email")).not.toBeInTheDocument();
  });
  it("displays provider labels even when a resource ID collides with a form node", async () => {
    const option = customGroup.options[0]!;
    const group = { ...customGroup, options: [{ ...option, reference: { ...option.reference, resourceId: "A" } }] };
    const registry = createSourceRegistry([{ id: "extra", getGroups: async () => [group] }]);
    const user = userEvent.setup();
    render(<PrefillEditor {...setup()} registry={registry} selections={[{ id: "extra" }]} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Extra source · Custom email");
  });
  it("preserves a mapping and permits clearing when configuration becomes unavailable", async () => {
    const props = setup(); const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} />);
    await openD(user); await choose(user);
    await user.click(screen.getByRole("button", { name: "Select" }));
    rerender(<PrefillEditor {...props} selections={undefined} />);
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeDisabled();
  });

  it("searches field labels case-insensitively and distinguishes no matches from no sources", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await screen.findByRole("group", { name: "Form A" });
    await user.type(screen.getByRole("searchbox"), "  eMaIL  ");
    expect(within(screen.getByRole("group", { name: "Form A" })).getByRole("button", { name: "Email" })).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Form A" })).queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox")); await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText("No sources match your search.")).toBeVisible();
    expect(screen.queryByText("No sources available for this field.")).not.toBeInTheDocument();
  });
  it("matches group labels and exposes matching options in collapsed groups", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user);
    await user.click(await screen.findByRole("button", { name: "Collapse Form A" }));
    expect(within(screen.getByRole("group", { name: "Form A" })).queryByRole("button", { name: "Email" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "form a");
    expect(within(screen.getByRole("group", { name: "Form A" })).getByRole("button", { name: "Email" })).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Form A" })).getByRole("button", { name: "Name" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Form B" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.getByRole("button", { name: "Expand Form A" })).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps the confirmed draft explicit when filtering hides its option", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    await user.type(screen.getByRole("searchbox"), "no-match");
    expect(screen.getByText("Selected: Form A · Email")).toBeVisible();
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
  });
  it("shows provider-specific errors and resets drafts on retry", async () => {
    let healthy = false;
    const registry = createSourceRegistry([
      { id: "extra", getGroups: async () => [customGroup] },
      { id: "broken", getGroups: async () => { if (!healthy) throw new Error("Service offline"); return []; } },
    ]);
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} registry={registry} selections={[{ id: "extra" }, { id: "broken" }]} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    expect(screen.getByRole("alert")).toHaveTextContent("broken: Service offline");
    healthy = true; await user.click(screen.getByRole("button", { name: "Retry sources" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Extra source" })).toBeVisible();
  });
  it("labels a disabled mapping without deleting it and restores availability on reenable", async () => {
    const props = setup(); const user = userEvent.setup();
    const { rerender } = render(<PrefillEditor {...props} />);
    await openD(user); await choose(user); await user.click(screen.getByRole("button", { name: "Select" }));
    rerender(<PrefillEditor {...props} selections={[]} />);
    expect(screen.getByText(/Source unavailable: provider is disabled/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
    rerender(<PrefillEditor {...props} />);
    await waitFor(() => expect(screen.queryByText(/Source unavailable/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Clear prefill for Email" })).toBeVisible();
  });
  it.each(["missing", "failed"])("preserves and clears a %s source mapping", async (mode) => {
    const props = setup(); const selections = [{ id: "extra" }];
    const healthy = createSourceRegistry([{ id: "extra", getGroups: async () => [customGroup] }]);
    const user = userEvent.setup(); const { rerender } = render(<PrefillEditor {...props} registry={healthy} selections={selections} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    await user.click(screen.getByRole("button", { name: "Select" }));
    const changed = createSourceRegistry([{ id: "extra", getGroups: async () => { if (mode === "failed") throw new Error("offline"); return []; } }]);
    rerender(<PrefillEditor {...props} registry={changed} selections={selections} />);
    expect(await screen.findByText(mode === "failed" ? /provider could not be loaded/ : /field is no longer offered/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Extra source · Custom email");
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.queryByText(/Source unavailable/)).not.toBeInTheDocument();
  });
  it("retries availability and refreshes a changed label without changing reference identity", async () => {
    let failed = false; let renamed = false;
    const registry = createSourceRegistry([{ id: "extra", getGroups: async () => {
      if (failed) throw new Error("offline");
      return [{ ...customGroup, label: renamed ? "Renamed source" : customGroup.label }];
    } }]);
    const props = setup(); const selections = [{ id: "extra" }];
    const user = userEvent.setup(); const { rerender } = render(<PrefillEditor {...props} registry={registry} selections={selections} />);
    await openD(user); await choose(user, "Extra source", "Custom email");
    failed = true; await user.click(screen.getByRole("button", { name: "Select" }));
    expect(await screen.findByText(/provider could not be loaded/)).toBeVisible();
    failed = false; renamed = true;
    await user.click(screen.getByRole("button", { name: "Retry source for Email" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Renamed source · Custom email"));
    rerender(<PrefillEditor {...props} registry={registry} selections={[]} />);
    expect(screen.getByRole("button", { name: "Clear prefill for Email" })).toBeVisible();
  });

  it("updates navigation and detail counts on assign, replace, and clear", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user); await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Form D" })).toHaveAccessibleDescription("1 of 2 mapped");
    expect(screen.getByRole("button", { name: "Form E" })).toHaveAccessibleDescription("0 of 2 mapped");
    expect(screen.getByText("1 of 2 fields mapped")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Replace prefill for Email" }));
    await choose(user, "Form B"); await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByText("1 of 2 fields mapped")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.getByText("0 of 2 fields mapped")).toBeVisible();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toHaveFocus();
  });
  it("turns editing off and on with the keyboard without losing mappings", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user); await user.click(screen.getByRole("button", { name: "Select" }));
    const toggle = screen.getByRole("switch", { name: "Enable prefill for Form D" });
    toggle.focus(); await user.keyboard(" ");
    expect(toggle).not.toBeChecked(); expect(toggle).toHaveFocus();
    expect(screen.getByText("Editing is off. Existing mappings are preserved.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear prefill for Email" })).toBeDisabled();
    expect(screen.getByText("1 of 2 fields mapped")).toBeVisible();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent("Form A · Email");
  });
  it("keeps the editing toggle independent between form instances", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await user.click(screen.getByRole("switch", { name: "Enable prefill for Form A" }));
    await user.click(screen.getByRole("button", { name: "Form B" }));
    expect(screen.getByRole("switch", { name: "Enable prefill for Form B" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Form A" }));
    expect(screen.getByRole("switch", { name: "Enable prefill for Form A" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeDisabled();
  });
  it("discards an open draft when editing is disabled externally", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />);
    await openD(user); await choose(user);
    // External state changes can occur while native modality blocks pointer input behind it.
    fireEvent.click(screen.getByRole("switch", { name: "Enable prefill for Form D" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Enable prefill for Form D" }));
    expect(screen.getByRole("button", { name: "Set prefill for Email" })).toBeVisible();
  });
  it("keeps focus in the field region after clearing during configuration failure", async () => {
    const props = setup(); const user = userEvent.setup(); const { rerender } = render(<PrefillEditor {...props} />);
    await openD(user); await choose(user); await user.click(screen.getByRole("button", { name: "Select" }));
    rerender(<PrefillEditor {...props} selections={undefined} />);
    await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
    expect(screen.getByRole("region", { name: "Form D fields" })).toHaveFocus();
  });
  it("shows provider-supplied source descriptions without interpreting provider IDs", async () => {
    const user = userEvent.setup(); render(<PrefillEditor {...setup()} />); await openD(user);
    expect(await screen.findByText("Direct dependency")).toBeVisible();
    expect(screen.getByText("Indirect dependency")).toBeVisible();
    expect(screen.getByText("Global data")).toBeVisible();
  });

});
