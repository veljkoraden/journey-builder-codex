import { createHash } from "node:crypto";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "./fixtures";

const ids = ["direct-forms", "indirect-forms", "global-properties"];
const fieldButton = (page: Page) => page.getByRole("button", { name: /^(Set|Replace) prefill for Email$/ });
async function selectForm(page: Page, name = "Form D") {
  await page.getByRole("button", { name, exact: true }).click();
}
async function openEmail(page: Page) {
  await fieldButton(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function chooseEmail(page: Page, form = "Form A") {
  await page.getByRole("group", { name: form, exact: true }).getByRole("button", { name: "Email", exact: true }).click();
}
async function confirm(page: Page) {
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file });
  await info.attach(name, { path: file, contentType: "image/png" });
}

test("loads the pinned graph over HTTP and completes mapping, navigation, replacement and clear", async ({ page, environment, request }, info) => {
  const response = await request.get(environment.graphUrl);
  expect(response.status()).toBe(200);
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(environment.graphHash);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const graphResponse = page.waitForResponse(environment.graphUrl);
  await page.goto(environment.url);
  expect((await graphResponse).status()).toBe(200);
  await expect(page.getByRole("navigation", { name: "Forms" }).getByRole("button")).toHaveCount(6);
  await selectForm(page); await openEmail(page);
  await expect(page.getByRole("button", { name: "Select", exact: true })).toBeDisabled();
  await expect(page.getByText("Direct dependency", { exact: true })).toBeVisible();
  await expect(page.getByText("Indirect dependency", { exact: true })).toBeVisible();
  await chooseEmail(page); await screenshot(page, info, "selected-source"); await confirm(page);
  await expect(fieldButton(page)).toHaveText("Form A · Email");
  await expect(fieldButton(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "Form D", exact: true })).toHaveAccessibleDescription("1 of 7 mapped");
  await selectForm(page, "Form E");
  await expect(fieldButton(page)).toHaveAccessibleName("Set prefill for Email");
  await selectForm(page); await expect(fieldButton(page)).toHaveText("Form A · Email");
  await openEmail(page); await chooseEmail(page, "Form B");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(fieldButton(page)).toHaveText("Form A · Email");
  await openEmail(page); await chooseEmail(page, "Form B"); await confirm(page);
  await expect(fieldButton(page)).toHaveText("Form B · Email");
  await screenshot(page, info, "mapped-field");
  await page.getByRole("button", { name: "Clear prefill for Email" }).click();
  await expect(fieldButton(page)).toHaveAccessibleName("Set prefill for Email");
  await expect(fieldButton(page)).toBeFocused();
  await expect(page.getByText("0 of 7 fields mapped", { exact: true })).toBeVisible();
});

test("native keyboard dialog, no-match focus, toggle preservation and reload reset", async ({ page, environment }) => {
  await page.goto(environment.url); await selectForm(page);
  await fieldButton(page).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect(await page.getByRole("dialog").evaluate((element) => element.matches(":modal"))).toBe(true);
  // Native modality prevents focus from escaping to the background.
  await page.getByRole("button", { name: "Form E", exact: true }).evaluate((element: HTMLButtonElement) => element.focus());
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("searchbox").fill("not-a-source");
  await expect(page.getByText("No sources match your search.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(fieldButton(page)).toBeFocused();
  await openEmail(page); await chooseEmail(page);
  await page.getByRole("button", { name: "Select", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(fieldButton(page)).toHaveText("Form A · Email");
  const toggle = page.getByRole("switch", { name: "Enable prefill for Form D" });
  await toggle.focus(); await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked(); await expect(fieldButton(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Clear prefill for Email" })).toBeDisabled();
  await page.keyboard.press("Space"); await expect(fieldButton(page)).toBeEnabled();
  await expect(fieldButton(page)).toHaveText("Form A · Email");
  await page.reload(); await selectForm(page);
  await expect(fieldButton(page)).toHaveAccessibleName("Set prefill for Email");
  await expect(toggle).toBeChecked();
});

for (let mask = 0; mask < 8; mask += 1) {
  test(`runtime source combination ${mask} controls the actual dialog`, async ({ page, environment }) => {
    const before = await environment.assetsHash();
    await environment.setConfiguration({ providers: ids.map((id, index) => ({ id, enabled: !!(mask & (1 << index)) })) });
    await page.goto(environment.url); await selectForm(page); await openEmail(page);
    await expect(page.getByText("Loading sources…", { exact: true })).toHaveCount(0);
    const names = ["Form B", "Form A", "Sample organization"];
    for (let index = 0; index < names.length; index += 1) {
      await expect(page.getByRole("group", { name: names[index]!, exact: true })).toHaveCount(mask & (1 << index) ? 1 : 0);
    }
    if (mask === 0) {
      await expect(page.getByText("No sources available for this field.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Select", exact: true })).toBeDisabled();
    }
    expect(await environment.assetsHash()).toBe(before);
  });
}

test("settings refresh preserves unavailable mappings and recovers invalid configuration", async ({ page, environment }, info) => {
  await page.goto(environment.url); await selectForm(page); await openEmail(page); await chooseEmail(page); await confirm(page);
  const hash = await environment.assetsHash();
  await environment.setConfiguration({ providers: [{ id: "unknown", enabled: true }] });
  await page.getByRole("button", { name: "Refresh source settings" }).click();
  await expect(page.getByRole("alert")).toContainText("Unknown source provider");
  await expect(fieldButton(page)).toBeDisabled();
  await expect(fieldButton(page)).toHaveText("Form A · Email");
  await environment.setConfiguration({ providers: [{ id: "global-properties", enabled: true }] });
  await page.getByRole("button", { name: "Retry source configuration" }).click();
  await expect(page.getByText("Source unavailable: provider is disabled. The mapping is preserved.")).toBeVisible();
  await screenshot(page, info, "unavailable-mapping");
  await page.getByRole("button", { name: "Clear prefill for Email" }).click();
  await expect(fieldButton(page)).toBeFocused(); await openEmail(page);
  await expect(page.getByRole("group", { name: "Sample organization" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Form A", exact: true })).toHaveCount(0);
  expect(await environment.assetsHash()).toBe(hash);
});

test("real mock server failure hides forms and recovers through retry", async ({ page, request, environment }) => {
  await environment.breakGraph();
  expect((await request.get(environment.graphUrl)).status()).toBe(500);
  await page.goto(environment.url);
  // Official mock omits CORS on 500; the browser exposes a connection failure.
  await expect(page.getByRole("alert")).toContainText("Unable to reach the blueprint server");
  await expect(page.getByRole("navigation", { name: "Forms" })).toHaveCount(0);
  await environment.restoreGraph();
  await page.getByRole("button", { name: "Try again", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Forms" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("invalid graph blocks editing and recovers with corrected server data", async ({ page, environment }) => {
  await environment.setGraph({ ...environment.originalGraph, edges: [{ source: "missing-node", target: environment.originalGraph.nodes[0]!.id }] });
  await page.goto(environment.url);
  await expect(page.getByRole("alert")).toContainText("Invalid blueprint dependencies");
  await expect(page.getByRole("navigation", { name: "Forms" })).toHaveCount(0);
  await environment.restoreGraph(); await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Forms" })).toBeVisible();
});

for (const width of [320, 390, 768]) {
  test(`source search and dialog controls fit a ${width}px viewport`, async ({ page, environment }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(environment.url); await selectForm(page); await openEmail(page);
    await page.getByRole("button", { name: "Collapse Form A", exact: true }).click();
    await page.getByRole("searchbox").fill(" FORM A ");
    await expect(page.getByRole("group", { name: "Form B", exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Form A", exact: true }).getByRole("button", { name: "Email", exact: true })).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await expect(page.getByRole("button", { name: "Expand Form A", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand Form A", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.getByRole("dialog").boundingBox();
    expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const cancel = await page.getByRole("button", { name: "Cancel", exact: true }).boundingBox();
    expect(cancel!.y + cancel!.height).toBeLessThanOrEqual(844);
    await screenshot(page, info, `dialog-${width}`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(fieldButton(page)).toBeFocused();
  });
}
