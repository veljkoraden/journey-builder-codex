import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { normalizeBlueprint } from "../blueprint/normalizeBlueprint";
import { blueprintFixture } from "../test/blueprintFixture";
import { FormBrowser } from "./FormBrowser";

const blueprint = () => normalizeBlueprint(blueprintFixture());

describe("form browser", () => {
  it("selects the first instance and renders its labels, keys and required markers", () => {
    render(<FormBrowser blueprint={blueprint()} />);
    expect(screen.getByRole("button", { name: "Form A" })).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByRole("region", { name: "Form A fields" });
    expect(within(detail).getByText("Email address")).toBeVisible();
    expect(within(detail).getByText("email")).toBeVisible();
    expect(within(detail).getByText("Required")).toBeVisible();
    expect(within(detail).getAllByRole("listitem")).toHaveLength(3);
    expect(within(detail).getByText("array")).toBeVisible();
    expect(within(detail).getByText("object")).toBeVisible();
    expect(within(detail).queryByText("Submit")).not.toBeInTheDocument();
  });

  it("selects a separate node sharing the same form definition", async () => {
    const user = userEvent.setup();
    render(<FormBrowser blueprint={blueprint()} />);
    await user.click(screen.getByRole("button", { name: "Form B" }));
    expect(screen.getByRole("region", { name: "Form B fields" })).toHaveTextContent("Email address");
    expect(screen.getByRole("button", { name: "Form A" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Form B" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changes visible fields using only the keyboard", async () => {
    const user = userEvent.setup();
    render(<FormBrowser blueprint={blueprint()} />);
    await user.tab(); await user.tab(); await user.tab();
    expect(screen.getByRole("button", { name: "Form C" })).toHaveFocus();
    await user.keyboard("{Enter}");
    const detail = screen.getByRole("region", { name: "Form C fields" });
    expect(within(detail).getByText("Age")).toBeVisible();
    expect(within(detail).queryByText("email")).not.toBeInTheDocument();
  });

  it("keeps duplicate names selectable as distinct nodes", async () => {
    const user = userEvent.setup();
    const data = blueprint();
    render(<FormBrowser blueprint={{ ...data, forms: data.forms.map((form) => ({ ...form, name: "Duplicate" })) }} />);
    const buttons = screen.getAllByRole("button", { name: "Duplicate" });
    await user.click(buttons[2]!);
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Duplicate fields" })).toHaveTextContent("Age");
  });

  it("shows an empty blueprint state without a misleading selection", () => {
    render(<FormBrowser blueprint={{ ...blueprint(), forms: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("This blueprint has no forms.");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it.each(["empty", "buttons only"])("shows a no-fields state for %s definitions", (mode) => {
    const data = blueprint();
    const forms = data.forms.map((form) => ({ ...form, fields: mode === "empty" ? [] : form.fields.filter((field) => field.controlType === "button") }));
    render(<FormBrowser blueprint={{ ...data, forms }} />);
    expect(screen.getByRole("status")).toHaveTextContent("This form has no prefillable fields.");
  });

  it("falls back safely when the selected node disappears", async () => {
    const user = userEvent.setup();
    const data = blueprint();
    const { rerender } = render(<FormBrowser blueprint={data} />);
    await user.click(screen.getByRole("button", { name: "Form B" }));
    rerender(<FormBrowser blueprint={{ ...data, forms: data.forms.filter((form) => form.nodeId !== "node-b") }} />);
    expect(screen.getByRole("region", { name: "Form A fields" })).toBeVisible();
  });

  it("renders server labels as text rather than markup", () => {
    const data = blueprint();
    render(<FormBrowser blueprint={{ ...data, forms: data.forms.map((form) => ({ ...form, name: "<img src=x onerror=alert(1)>" })) }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
