import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("application shell", () => {
  it("provides a main landmark with one clear page heading", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toHaveTextContent("Journey Builder");
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Journey Builder" }))
      .toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("explains the unconnected workspace and where form settings will appear", () => {
    render(<App />);

    const workspace = screen.getByRole("region", { name: "Your form workspace" });
    expect(within(workspace).getByText("Form data is not connected yet.")).toBeVisible();
    expect(within(workspace).getByText(
      "Once connected, your forms and their prefill settings will appear here.",
    )).toBeVisible();
  });

  it("makes the skip link the first keyboard stop and targets focusable main content", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveFocus();
    const main = screen.getByRole("main");
    expect(skipLink).toHaveAttribute("href", `#${main.id}`);
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("renders a single workspace under React StrictMode", () => {
    render(<StrictMode><App /></StrictMode>);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Your form workspace" })).toHaveLength(1);
  });
});
