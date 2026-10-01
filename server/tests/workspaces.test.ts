/**
 * Logins and workspaces: a login sees its own workspace's runs, products and
 * judgements and nothing else; the admin sees every run; a revoked session
 * stops working at once; repeated bad passwords are throttled per client.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { createModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { Scope } from "../src/domain/index.js";
import { AccountCommands, App, LoginThrottle, Passwords } from "../src/http/index.js";
import { genreRun, minimalPacket, recorded, productPacket } from "./fixtures.js";

const MODEL_ID = "faux-model";
const PASSWORD = "correct horse battery";

let dir: string;
let app: App;
let store: SqliteResearchStore;
let faux: ReturnType<typeof fauxProvider>;

async function build(): Promise<App> {
  const settings: Settings = {
    ...Env.settings(),
    model: MODEL_ID,
    appUser: "ash",
    appPasswordHash: await Passwords.hash(PASSWORD),
    jwtSecret: "s".repeat(32),
    corpusPath: join(dir, "corpus"),
    staticDir: join(dir, "static"),
    databasePath: join(dir, "research.db"),
    traceDir: join(dir, "traces"),
  };
  store = new SqliteResearchStore(settings.databasePath);
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const supervisor = new RunSupervisor({ store, settings, models, retry: { attempts: 1, baseMs: 0, capMs: 0 } });
  return new App({ settings, store, supervisor });
}

async function addUser(username: string, workspace: string): Promise<void> {
  const id = store.accounts.workspaceNamed(workspace)?.id ?? store.accounts.addWorkspace(workspace).id;
  store.accounts.addAccount({ username, passwordHash: await Passwords.hash(PASSWORD), workspaceId: id, isAdmin: false });
}

const call = (path: string, init: RequestInit & { cookie?: string; ip?: string } = {}) =>
  app.fetch(
    new Request(`http://test${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...(init.ip ? { "X-Forwarded-For": init.ip } : {}),
      },
    }),
  );

async function login(username: string, password = PASSWORD, ip = "10.0.0.1"): Promise<Response> {
  return await call("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }), ip });
}

async function cookieFor(username: string): Promise<string> {
  const response = await login(username);
  expect(response.status).toBe(200);
  return (response.headers.get("set-cookie") ?? "").split(";")[0]!;
}

async function startRun(cookie: string, product = "MagnaCalm 400mg"): Promise<string> {
  faux.setResponses(genreRun());
  const created = await call("/api/research/runs", { method: "POST", cookie, body: JSON.stringify({ brief: { product }, nodes: ["product_data"] }) });
  expect(created.status).toBe(200);
  const { id } = (await created.json()) as { id: string };
  await app.supervisor.waitFor(id);
  return id;
}

const ids = async (response: Response) => ((await response.json()) as { data: Array<{ id: string }> }).data.map((r) => r.id);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-ws-"));
  app = await build();
  await addUser("client", "acme");
  await addUser("brother", "acme");
  await addUser("stranger", "other");
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("seeding", () => {
  it("creates the admin from MRA_APP_* once, and never again", async () => {
    await app.close();
    app = await build();
    const admins = store.accounts.list().filter((a) => a.is_admin);
    expect(admins.map((a) => [a.username, a.workspace])).toEqual([["ash", "admin"]]);
    expect((await login("ash")).status).toBe(200);
  });
});

describe("workspace isolation", () => {
  it("shows a run to its workspace and the admin, and 404s it for everyone else", async () => {
    const client = await cookieFor("client");
    const runId = await startRun(client);

    expect(await ids(await call("/api/research/runs", { cookie: await cookieFor("brother") }))).toEqual([runId]);
    expect(await ids(await call("/api/research/runs", { cookie: await cookieFor("ash") }))).toEqual([runId]);

    const stranger = await cookieFor("stranger");
    expect(await ids(await call("/api/research/runs", { cookie: stranger }))).toEqual([]);
    const sha = "a".repeat(64);
    for (const [path, method] of [
      [`/api/research/runs/${runId}`, "GET"],
      [`/api/research/runs/${runId}/calls`, "GET"],
      [`/api/research/runs/${runId}/events`, "GET"],
      [`/api/research/runs/${runId}/sources/${sha}`, "GET"],
      [`/api/research/runs/${runId}/trace`, "GET"],
      [`/api/research/runs/${runId}/stop`, "POST"],
      [`/api/research/runs/${runId}/steer`, "POST"],
    ] as const) {
      const response = await call(path, { method, cookie: stranger, body: method === "POST" ? "{}" : undefined });
      expect([path, response.status]).toEqual([path, 404]);
    }
  });

  it("scopes products and their rows the same way", async () => {
    const runId = await startRun(await cookieFor("client"));
    const productId = store.getRun(runId)!.product_id;
    const stranger = await cookieFor("stranger");

    expect(await ids(await call("/api/research/products", { cookie: stranger }))).toEqual([]);
    for (const tail of ["", "/runs", "/rows"]) {
      expect((await call(`/api/research/products/${productId}${tail}`, { cookie: stranger })).status).toBe(404);
    }
    expect(await ids(await call("/api/research/products", { cookie: await cookieFor("brother") }))).toEqual([productId]);
  });

  it("keeps two workspaces' runs of one product apart", async () => {
    const mine = await startRun(await cookieFor("client"));
    const theirs = await startRun(await cookieFor("stranger"));
    const productId = store.getRun(mine)!.product_id;
    expect(store.getRun(theirs)!.product_id).toBe(productId);
    expect(store.products.packetRows(productId, Scope.everything).attributes).toHaveLength(2);

    const rows = (await (await call(`/api/research/products/${productId}/rows`, { cookie: await cookieFor("brother") })).json()) as any;
    expect(new Set(rows.attributes.map((r: { run_id: string }) => r.run_id))).toEqual(new Set([mine]));
  });

  it("does not hand one workspace's stage-1 packet to another's stage 2", async () => {
    const runId = await startRun(await cookieFor("client"));
    expect(store.getRun(runId)!.status).toBe("completed");
    const plan = async (username: string) => {
      const response = await call("/api/research/review-mining/plan", {
        method: "POST",
        cookie: await cookieFor(username),
        body: JSON.stringify({ brief: { product: "MagnaCalm 400mg" } }),
      });
      return ((await response.json()) as { ready: boolean; detail?: string });
    };
    expect((await plan("brother")).detail ?? "").not.toMatch(/no stage-1 packet/);
    expect(await plan("stranger")).toMatchObject({ ready: false, detail: expect.stringMatching(/no stage-1 packet/) });
  });

  it("gives runs from before workspaces to the admin only", () => {
    const path = join(dir, "old.db");
    const old = new Database(path);
    old.exec(`CREATE TABLE research_runs (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL DEFAULT '', stage INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', brief TEXT NOT NULL DEFAULT '{}',
      reject_kinds TEXT NOT NULL DEFAULT '[]', packet TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ended_at TEXT NOT NULL DEFAULT '');
      INSERT INTO research_runs (id, status, created_at, updated_at) VALUES ('legacy', 'completed', 't', 't');`);
    old.close();
    const migrated = new SqliteResearchStore(path);
    try {
      expect(migrated.getRun("legacy")!.workspace_id).toBe("admin");
      expect(migrated.listRuns(Scope.of("acme-id"))).toEqual([]);
      expect(migrated.listRuns(Scope.everything).map((r) => r.id)).toEqual(["legacy"]);
    } finally {
      migrated.close();
    }
  });
});

describe("judgements", () => {
  it("belong to one workspace, and a run only applies its own workspace's", async () => {
    const client = await cookieFor("client");
    const added = await call("/api/research/judgements", {
      method: "POST",
      cookie: client,
      body: JSON.stringify({ kind: "custom", text: "prefer UK sources", rejects_kinds: [] }),
    });
    const { id } = (await added.json()) as { id: string };

    const stranger = await cookieFor("stranger");
    expect(await ids(await call("/api/research/judgements", { cookie: stranger }))).toEqual([]);
    expect((await call(`/api/research/judgements/${id}`, { method: "DELETE", cookie: stranger })).status).toBe(404);
    expect(store.getRun(await startRun(stranger))!.judgement_ids).toEqual([]);
    expect(store.getRun(await startRun(await cookieFor("brother")))!.judgement_ids).toEqual([id]);
  });
});

describe("sessions", () => {
  it("stops honouring a token after logout, a disable, or a password change", async () => {
    for (const revoke of [
      async (cookie: string) => void (await call("/api/auth/logout", { method: "POST", cookie })),
      async () => void store.accounts.setDisabled("client", true),
      async () => void store.accounts.setPassword("client", await Passwords.hash("another long password")),
    ]) {
      store.accounts.setDisabled("client", false);
      store.accounts.setPassword("client", await Passwords.hash(PASSWORD));
      const cookie = await cookieFor("client");
      expect((await call("/api/research/runs", { cookie })).status).toBe(200);
      await revoke(cookie);
      expect((await call("/api/research/runs", { cookie })).status).toBe(401);
    }
  });

  it("reports who is signed in and where", async () => {
    const session = (await (await call("/api/auth/session", { cookie: await cookieFor("client") })).json()) as any;
    expect(session).toMatchObject({ authenticated: true, user: "client", workspace: "acme", is_admin: false });
  });
});

describe("login throttle", () => {
  it("refuses a client after five failures, even with the right password, whatever it forges to the left", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await login("client", "wrong", `198.51.100.${i}, 203.0.113.9`)).status).toBe(401);
    }
    const blocked = await login("client", PASSWORD, "1.1.1.1, 203.0.113.9");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await login("client", PASSWORD, "203.0.113.10")).status).toBe(200);
  });

  it("forgets failures once the window has passed", () => {
    let now = 0;
    const throttle = new LoginThrottle(2, 1000, () => now);
    throttle.fail("x");
    throttle.fail("x");
    expect(throttle.retryAfterSeconds("x")).toBe(1);
    now = 1001;
    expect(throttle.retryAfterSeconds("x")).toBe(0);
  });
});

describe("the accounts CLI", () => {
  it("adds a workspace and a user, refuses a short password, and disables", async () => {
    const out: string[] = [];
    const answers = ["short", "short", "a long enough password", "a long enough password"];
    const cli = new AccountCommands(store.accounts, async () => answers.shift()!, (line) => out.push(line));

    expect(await cli.run(["add-workspace", "newco"])).toBe(0);
    expect(await cli.run(["add-user", "nina", "newco"])).toBe(1);
    expect(out.at(-1)).toMatch(/at least 12/);
    expect(await cli.run(["add-user", "nina", "newco"])).toBe(0);
    expect((await login("nina", "a long enough password")).status).toBe(200);
    expect(await cli.run(["disable", "nina"])).toBe(0);
    expect((await login("nina", "a long enough password", "10.0.0.2")).status).toBe(401);
    expect(await cli.run(["add-user", "eve", "newco", "--admin"])).toBe(1);
    expect(await cli.run(["nonsense"])).toBe(2);
  });

  it("reads both piped answers from one reader, and prints only the hash on stdout", () => {
    const server = new URL("..", import.meta.url).pathname;
    const piped = spawnSync(process.execPath, ["--import", "tsx", "src/hashpw.ts"], {
      cwd: server,
      input: "a long enough password\na long enough password\n",
      encoding: "utf8",
    });
    expect(piped.status).toBe(0);
    expect(piped.stdout.trim()).toMatch(/^scrypt:[^:\s]+:[^:\s]+$/);
  });
});
