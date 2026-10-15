import { fork, execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import provenance from "./mock/provenance.json" with { type: "json" };

const root = process.cwd();
const mockRoot = path.join(root, "e2e/mock");
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

export async function startEnvironment() {
  const directory = await mkdtemp(path.join(tmpdir(), "journey-acceptance-"));
  const mockDirectory = path.join(directory, "mock");
  const dist = path.join(directory, "dist");
  let child: ChildProcess | undefined;
  const app = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/acceptance/")) {
        response.writeHead(404).end();
        return;
      }
      const relative =
        decodeURIComponent(url.pathname.slice("/acceptance/".length)) || "index.html";
      const file = path.resolve(dist, relative);
      if (!file.startsWith(`${dist}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(file);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
      };
      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  const stop = async () => {
    if (app.listening)
      await new Promise<void>((resolve, reject) => {
        app.close((error) => (error ? reject(error) : resolve()));
        app.closeAllConnections();
      });
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
      child.kill();
      const force = setTimeout(() => child?.kill("SIGKILL"), 2000);
      await exited;
      clearTimeout(force);
    }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    for (const [name, expected] of Object.entries(provenance.sha256)) {
      if (hash(await readFile(path.join(mockRoot, name))) !== expected)
        throw new Error(`Pinned mock checksum mismatch: ${name}`);
    }
    await mkdir(mockDirectory);
    const graph = await readFile(path.join(mockRoot, "graph.json"));
    await writeFile(path.join(mockDirectory, "graph.json"), graph);
    const source = await readFile(path.join(mockRoot, "index.cjs"), "utf8");
    const listen = "server.listen(3000, () => {";
    if (!source.includes(listen)) throw new Error("Pinned mock listen patch no longer matches.");
    // Request handling is unchanged. Only bind/port and readiness reporting differ.
    await writeFile(
      path.join(mockDirectory, "index.cjs"),
      source.replace(
        listen,
        'server.listen(0, "127.0.0.1", () => { process.send({ port: server.address().port });',
      ),
    );
    child = fork(path.join(mockDirectory, "index.cjs"), [], { silent: true });
    const mockPort = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mock startup timed out")), 10_000);
      child!.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child!.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Mock exited during startup: ${code}`));
      });
      child!.once("message", (message: unknown) => {
        clearTimeout(timer);
        if (
          typeof message !== "object" ||
          message === null ||
          !("port" in message) ||
          typeof message.port !== "number"
        ) {
          reject(new Error("Invalid mock readiness message"));
          return;
        }
        resolve(message.port);
      });
    });
    const mockUrl = `http://127.0.0.1:${mockPort}`;
    // Build from this checkout, overriding public endpoint variables regardless of local .env.
    await promisify(execFile)(
      process.execPath,
      [
        path.join(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--base=/acceptance/",
        "--outDir",
        dist,
      ],
      {
        cwd: root,
        timeout: 60_000,
        env: {
          ...process.env,
          VITE_API_BASE_URL: mockUrl,
          VITE_TENANT_ID: "1",
          VITE_BLUEPRINT_ID: "bp_01jk766tckfwx84xjcxazggzyc",
        },
      },
    );
    await new Promise<void>((resolve, reject) => {
      app.once("error", reject);
      app.listen(0, "127.0.0.1", resolve);
    });
    const address = app.address();
    if (!address || typeof address === "string") throw new Error("Missing app port");
    // Scenarios own their baseline; valid shipped subsets must not break acceptance.
    const defaultConfiguration = JSON.stringify({
      providers: ["direct-forms", "indirect-forms", "global-properties"].map((id) => ({
        id,
        enabled: true,
      })),
    });
    const graphPath = path.join(mockDirectory, "graph.json");
    return {
      url: `http://127.0.0.1:${address.port}/acceptance/`,
      graphUrl: `${mockUrl}/api/v1/1/actions/blueprints/bp_01jk766tckfwx84xjcxazggzyc/graph`,
      graphHash: hash(graph),
      reset: async () => {
        await writeFile(graphPath, graph);
        await writeFile(path.join(dist, "source-config.json"), defaultConfiguration);
      },
      setConfiguration: (value: unknown) =>
        writeFile(path.join(dist, "source-config.json"), JSON.stringify(value)),
      breakGraph: () => rm(graphPath),
      restoreGraph: () => writeFile(graphPath, graph),
      setGraph: (value: unknown) => writeFile(graphPath, JSON.stringify(value)),
      originalGraph: JSON.parse(graph.toString()) as {
        nodes: { id: string }[];
        edges: { source: string; target: string }[];
      },
      assetsHash: async () => {
        const files = (await readdir(path.join(dist, "assets")))
          .filter((name) => name.endsWith(".js"))
          .sort();
        return hash(
          Buffer.concat(
            await Promise.all(files.map((name) => readFile(path.join(dist, "assets", name)))),
          ),
        );
      },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
export type AcceptanceEnvironment = Awaited<ReturnType<typeof startEnvironment>>;
