import { describe, expect, it } from "vitest";
import { readEndpoint } from "./config";

describe("public API configuration", () => {
  it("uses the documented local mock defaults", () => {
    expect(readEndpoint({})).toEqual({
      ok: true,
      endpoint:
        "http://localhost:3000/api/v1/1/actions/blueprints/bp_01jk766tckfwx84xjcxazggzyc/graph",
    });
  });

  it("preserves a deployment prefix and encodes each identifier as a path segment", () => {
    expect(
      readEndpoint({
        VITE_API_BASE_URL: "https://example.com/proxy///",
        VITE_TENANT_ID: "tenant/a",
        VITE_BLUEPRINT_ID: "blueprint ?#",
      }),
    ).toEqual({
      ok: true,
      endpoint:
        "https://example.com/proxy/api/v1/tenant%2Fa/actions/blueprints/blueprint%20%3F%23/graph",
    });
  });

  it.each([
    "",
    "/relative",
    "not a URL",
    "file:///tmp/mock",
    "https://user:secret@example.com",
    "https://example.com?x=1",
    "https://example.com#x",
  ])("rejects invalid or ambiguous base URL %s without exposing it", (base) => {
    const result = readEndpoint({ VITE_API_BASE_URL: base });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it.each(["", " ", ".", "..", " tenant"])("rejects invalid identifiers %j", (id) => {
    expect(readEndpoint({ VITE_TENANT_ID: id }).ok).toBe(false);
    expect(readEndpoint({ VITE_BLUEPRINT_ID: id }).ok).toBe(false);
  });
});
