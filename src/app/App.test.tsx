import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { blueprintFixture } from "../test/blueprintFixture";

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  vi.stubEnv("VITE_TENANT_ID", "1");
  vi.stubEnv("VITE_BLUEPRINT_ID", "test");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(blueprintFixture())))));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("application connection view", () => {
  it("preserves a clear heading and named workspace", async () => {
    render(<App />);
    expect(screen.getByRole("banner")).toHaveTextContent("Journey Builder");
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: "Journey Builder" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Your form workspace" })).toBeVisible();
    expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
  });

  it("announces loading while the request is pending", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading blueprint…");
  });

  it("shows form fields without claiming that mapping is available", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Form A fields" })).toHaveTextContent("Mapping controls will be added later.");
  });

  it("allows keyboard retry after a server error", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(blueprintFixture())));
    vi.stubGlobal("fetch", request);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("shows a validation error instead of a partial form list, then recovers on retry", async () => {
    const fixture = blueprintFixture();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...fixture, forms: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture))));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("missing form definition");
    expect(screen.queryByRole("navigation", { name: "Forms" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
  });

  it("shows an empty state for a valid empty graph", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "empty", nodes: [], edges: [], forms: [] }))));
    render(<App />);
    expect(await screen.findByText("This blueprint has no forms.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports invalid configuration without sending a request", () => {
    vi.stubEnv("VITE_API_BASE_URL", "invalid");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("restart the development server");
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("makes the skip link the first keyboard stop with a focusable main target", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Form A" });
    await user.tab();
    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveFocus();
    const main = screen.getByRole("main");
    expect(skipLink).toHaveAttribute("href", `#${main.id}`);
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("renders one successful workspace under StrictMode", async () => {
    render(<StrictMode><App /></StrictMode>);
    expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Your form workspace" })).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
