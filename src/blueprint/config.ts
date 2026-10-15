interface PublicEnvironment {
  VITE_API_BASE_URL?: string;
  VITE_TENANT_ID?: string;
  VITE_BLUEPRINT_ID?: string;
}

export type EndpointConfiguration = { ok: true; endpoint: string } | { ok: false; message: string };

export function readEndpoint(env: PublicEnvironment): EndpointConfiguration {
  try {
    const base = new URL(env.VITE_API_BASE_URL ?? "http://localhost:3000");
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error("Invalid base URL");
    }
    const tenant = env.VITE_TENANT_ID ?? "1";
    const blueprint = env.VITE_BLUEPRINT_ID ?? "bp_01jk766tckfwx84xjcxazggzyc";
    for (const id of [tenant, blueprint]) {
      if (!id.trim() || id !== id.trim() || id === "." || id === "..") {
        throw new Error("Invalid identifier");
      }
    }
    const path = base.pathname.replace(/\/+$/, "");
    return {
      ok: true,
      endpoint: `${base.origin}${path}/api/v1/${encodeURIComponent(tenant)}/actions/blueprints/${encodeURIComponent(blueprint)}/graph`,
    };
  } catch {
    return {
      ok: false,
      message:
        "Check the public API URL, tenant ID, and blueprint ID in .env, then restart the development server.",
    };
  }
}
