import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { dependencyFixture } from "../../test/dependencyFixture";
import { createDependencyGraph } from "../../dependencies/createDependencyGraph";
import { parseSourceConfiguration } from "../configuration";
import { loadSourceCatalog } from "../loadSourceCatalog";
import { createSourceRegistry } from "../registry";
import { sourceReferenceKey } from "../model";
import { PrefillEditor } from "../../ui/PrefillEditor";
import { teamDirectory } from "./teamDirectory";

const settings = { teamId: "onboarding", teamLabel: "Onboarding team" };
const registry = createSourceRegistry([teamDirectory]);
function context() {
  const data = dependencyFixture(["root"], []);
  const field = {
    key: "email",
    label: "Email",
    types: ["string"],
    controlType: null,
    required: false,
  };
  const blueprint = { ...data, forms: data.forms.map((form) => ({ ...form, fields: [field] })) };
  return {
    blueprint,
    dependencies: createDependencyGraph(blueprint),
    targetForm: blueprint.forms[0]!,
    targetField: field,
  };
}
const signal = () => new AbortController().signal;

describe("documented team directory extension", () => {
  it("requires explicit registration before configuration can enable it", () => {
    expect(() => createSourceRegistry([]).resolve([{ id: "team-directory" }])).toThrow(
      "Unknown source provider",
    );
  });
  it("resolves the documented runtime configuration into a root-form catalog", async () => {
    const selections = parseSourceConfiguration(
      { providers: [{ id: "team-directory", enabled: true, settings }] },
      registry,
    );
    const result = await loadSourceCatalog(registry, selections, context(), signal());
    expect(result).toEqual([
      {
        providerId: "team-directory",
        status: "success",
        groups: [
          {
            id: "onboarding",
            label: "Onboarding team",
            description: "Team directory",
            options: [
              {
                label: "Manager email",
                types: ["string"],
                reference: {
                  providerId: "team-directory",
                  resourceId: "onboarding",
                  fieldPath: ["manager_email"],
                },
              },
              {
                label: "Team name",
                types: ["string"],
                reference: {
                  providerId: "team-directory",
                  resourceId: "onboarding",
                  fieldPath: ["name"],
                },
              },
            ],
          },
        ],
      },
    ]);
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { teamId: "a" },
    { teamLabel: "Team" },
    { ...settings, teamId: " " },
    { ...settings, teamId: " padded " },
    { ...settings, teamId: 3 },
    { ...settings, teamLabel: " " },
    { ...settings, teamLabel: false },
    { ...settings, secret: "not-supported" },
  ])("rejects invalid settings %# in configuration and direct calls", async (invalid) => {
    expect(() =>
      parseSourceConfiguration(
        { providers: [{ id: "team-directory", enabled: true, settings: invalid }] },
        registry,
      ),
    ).toThrow("settings require");
    await expect(teamDirectory.getGroups(context(), invalid, signal())).rejects.toThrow(
      "settings require",
    );
  });
  it("validates disabled entries rather than hiding invalid settings", () => {
    expect(() =>
      parseSourceConfiguration(
        { providers: [{ id: "team-directory", enabled: false, settings: {} }] },
        registry,
      ),
    ).toThrow("settings require");
    expect(
      parseSourceConfiguration(
        { providers: [{ id: "team-directory", enabled: false, settings }] },
        registry,
      ),
    ).toEqual([]);
  });
  it("keeps reference identity stable across display-label changes", async () => {
    const first = await teamDirectory.getGroups(context(), settings, signal());
    const renamed = await teamDirectory.getGroups(
      context(),
      { ...settings, teamLabel: "Renamed" },
      signal(),
    );
    expect(first[0]!.label).not.toBe(renamed[0]!.label);
    expect(first[0]!.options.map((option) => sourceReferenceKey(option.reference))).toEqual(
      renamed[0]!.options.map((option) => sourceReferenceKey(option.reference)),
    );
  });
  it("separates resources, supports literal identifiers, and returns fresh output", async () => {
    const first = await teamDirectory.getGroups(context(), settings, signal());
    const other = await teamDirectory.getGroups(
      context(),
      { ...settings, teamId: "team.with.dots" },
      signal(),
    );
    expect(other[0]!.options[0]!.reference.resourceId).toBe("team.with.dots");
    expect(sourceReferenceKey(first[0]!.options[0]!.reference)).not.toBe(
      sourceReferenceKey(other[0]!.options[0]!.reference),
    );
    expect(await teamDirectory.getGroups(context(), settings, signal())).toEqual(first);
    expect((await teamDirectory.getGroups(context(), settings, signal()))[0]).not.toBe(first[0]);
  });
  it("honors cancellation before producing options", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      teamDirectory.getGroups(context(), settings, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
it("maps and clears the real extension through the unchanged editor", async () => {
  const data = context();
  const selections = parseSourceConfiguration(
    { providers: [{ id: "team-directory", enabled: true, settings }] },
    registry,
  );
  const user = userEvent.setup();
  render(
    <PrefillEditor
      blueprint={data.blueprint}
      dependencies={data.dependencies}
      selections={selections}
      registry={registry}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Set prefill for Email" }));
  await user.type(screen.getByRole("searchbox"), "manager");
  const group = await screen.findByRole("group", { name: "Onboarding team" });
  await user.click(within(group).getByRole("button", { name: "Manager email" }));
  await user.click(screen.getByRole("button", { name: "Select" }));
  expect(screen.getByRole("button", { name: "Replace prefill for Email" })).toHaveTextContent(
    "Onboarding team · Manager email",
  );
  await user.click(screen.getByRole("button", { name: "Clear prefill for Email" }));
  expect(screen.getByRole("button", { name: "Set prefill for Email" })).toHaveFocus();
});
