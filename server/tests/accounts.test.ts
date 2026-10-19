/** Client data stays siloed: a login sees only its own account's runs, an admin sees all, and nobody unauthenticated sees anything. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Stages, type Run } from "../src/domain/index.js";
import { App, Passwords } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { PostgresStores } from "./postgres-stores.js";

let pg: PostgresStores;
let app: App;

beforeAll(async () => {
  pg = await PostgresStores.start();
  const { settings, traces } = TestSettings.make({ appUser: "root", appPasswordHash: await Passwords.hash("root-password") });
  app = new App({ settings, traces, store: pg.store, services: new FakeWeb().services(), models: new Faux().models, generations: new NoBilling(), visuals: new FakeVisuals() });
});

afterAll(async () => {
  await pg.stop();
});

const login = async (username: string, password: string): Promise<string> => {
  const response = await app.fetch(new Request("http://test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }));
  expect(response.status).toBe(200);
  return (response.headers.get("set-cookie") ?? "").split(";")[0]!;
};

const get = async (path: string, cookie = ""): Promise<Response> => app.fetch(new Request(`http://test/api/research${path}`, { headers: { cookie } }));

describe("accounts", () => {
  it("keep one client's runs from another, while the admin sees both", async () => {
    await app.fetch(new Request("http://test/api/health"));
    const { store } = pg;
    const clientA = await store.accounts.addAccount("client-a");
    const clientB = await store.accounts.addAccount("client-b");
    await store.accounts.addUser({ username: "alice", passwordHash: await Passwords.hash("alice-password"), accountId: clientA.id, isAdmin: false });
    const input = { product_url: "https://x.example/p", product_name: null, markets: ["US" as const], known_competitors: [], brand_constraints: "", price_offer: "" };
    const ofB = await store.runs.create({ accountId: clientB.id, input, model: "m", stages: Stages.initial([]) });

    expect((await get("/runs")).status).toBe(401);
    const alice = await login("alice", "alice-password");
    expect(((await (await get("/runs", alice)).json()) as { runs: Run[] }).runs).toEqual([]);
    expect((await get(`/runs/${ofB.id}`, alice)).status).toBe(404);
    const root = await login("root", "root-password");
    expect((await get(`/runs/${ofB.id}`, root)).status).toBe(200);
  });
});
