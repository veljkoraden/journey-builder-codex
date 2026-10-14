import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { blueprintFixture } from "../test/blueprintFixture";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup(config: () => Promise<Response>) {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  vi.stubEnv("VITE_TENANT_ID", "1"); vi.stubEnv("VITE_BLUEPRINT_ID", "test");
  vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("source-config.json")
    ? config() : Promise.resolve(new Response(JSON.stringify(blueprintFixture())))));
}
it("renders runtime status alongside the real form browser", async () => {
  setup(async () => new Response(JSON.stringify({ providers: [{ id: "global-properties", enabled: true }] })));
  render(<App />);
  expect(await screen.findByText("1 prefill source enabled.")).toBeVisible();
  expect(await screen.findByRole("button", { name: "Form A" })).toBeVisible();
});
it("shows configuration errors and recovers to an empty selection", async () => {
  const config = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ providers: [{ id: "typo", enabled: false }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ providers: [] })));
  setup(config); render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unknown source provider");
  expect(screen.queryByText(/sources enabled/)).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry source configuration" }));
  expect(await screen.findByText("No prefill sources enabled.")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("announces pending configuration independently of blueprint loading", async () => {
  setup(() => new Promise(() => {})); render(<App />);
  await screen.findByRole("button", { name: "Form A" });
  expect(screen.getByRole("status")).toHaveTextContent("Loading source configuration");
});
