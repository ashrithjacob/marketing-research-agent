/**
 * The house rules bite.
 *
 * `check-conventions.mjs` is the layer that stops a correction being needed
 * twice, which makes its own failure mode quiet and expensive: a rule whose
 * regex stopped matching reports "clean" forever and nobody notices until the
 * bug it was written for comes back. So every rule is tested the only way that
 * proves anything — hand it a fixture repo containing exactly that bug and
 * check it is named, then hand it the fixed version and check it goes quiet.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
// @ts-expect-error - plain .mjs with no type declarations, by design
import { runChecks } from "../scripts/check-conventions.mjs";

let repo: string;

function write(rel: string, body: string): void {
  const p = join(repo, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}
function git(...args: string[]): void {
  execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
}
function rules(): string[] {
  return runChecks(repo).violations.map((v: { rule: string }) => v.rule);
}
function messageFor(rule: string): string {
  const v = runChecks(repo).violations.find(
    (v: { rule: string }) => v.rule === rule,
  );
  return v ? v.message : "";
}

/** A minimal repo that passes every check, for each test to then break. */
function scaffold(): void {
  write("frontend/src/api.ts", [
    "export interface Usage {",
    "  totalTokens?: number;",
    "}",
  ].join("\n"));
  write("server/src/settings.ts", [
    "const a = process.env['MRA_MODEL'];",
    'export const keys = ["MRA_MODEL", "OPENROUTER_API_KEY"];',
  ].join("\n"));
  write("server/src/store.ts", [
    "const SCHEMA = `",
    "CREATE TABLE IF NOT EXISTS research_runs (",
    "  id TEXT PRIMARY KEY,",
    "  totalTokens TEXT NOT NULL DEFAULT ''",
    ")",
    "`;",
  ].join("\n"));
  write("docker-compose.yaml", [
    "services:",
    "  mra:",
    "    ports: [\"127.0.0.1:8080:8000\"]",
    "    environment:",
    "      - MRA_MODEL=${MRA_MODEL}",
    "      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}",
  ].join("\n"));
  write("deploy/vps/docker-compose.yaml", [
    "services:",
    "  mra:",
    "    expose: [\"8000\"]",
  ].join("\n"));
  write("README.md", "Live at https://marketing.vanis.ai\n");
  write(".gitignore", ".env\n");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "base");
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "mra-conv-"));
  git("init", "-q");
  scaffold();
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

it("is quiet on a repo that follows the rules", () => {
  expect(runChecks(repo).violations).toEqual([]);
});

describe("client-server-field-parity", () => {
  it("catches the cockpit reading a field the server never sends", () => {
    // The real bug: server sends usage.totalTokens, RunView read
    // usage.total_tokens, the field was optional, tsc said nothing, and the
    // cockpit showed "Tokens —" for days.
    write("frontend/src/api.ts", [
      "export interface Usage {",
      "  total_tokens?: number;",
      "}",
    ].join("\n"));
    expect(rules()).toContain("client-server-field-parity");
    expect(messageFor("client-server-field-parity")).toContain("total_tokens");
  });

  it("allows a snake_case name the server does send", () => {
    // Most of this API is honestly snake_case, straight out of SQLite. The
    // rule is parity with the server, not a naming convention.
    write("frontend/src/api.ts", [
      "export interface RunSummary {",
      "  created_at: string;",
      "}",
    ].join("\n"));
    write("server/src/store.ts", "const sql = 'select created_at from runs';");
    expect(rules()).not.toContain("client-server-field-parity");
  });

  it("still bites when the client surface is a directory, not one file", () => {
    // api.ts was split into frontend/src/api/; a check reading one named path
    // would have gone quiet the day it moved.
    execFileSync("rm", [join(repo, "frontend/src/api.ts")]);
    write("frontend/src/api/types.ts", [
      "export interface Usage {",
      "  total_tokens?: number;",
      "}",
    ].join("\n"));
    expect(rules()).toContain("client-server-field-parity");
    expect(messageFor("client-server-field-parity")).toContain("total_tokens");
  });

  it("reports dark, not clean, when the client surface is gone entirely", () => {
    execFileSync("rm", [join(repo, "frontend/src/api.ts")]);
    const result = runChecks(repo);
    expect(result.violations.map((v: { rule: string }) => v.rule)).not.toContain(
      "client-server-field-parity",
    );
    expect(result.dark.join(" ")).toContain("API surface");
  });
});

describe("env-declared-in-settings", () => {
  it("catches process.env read outside settings.ts", () => {
    write("server/src/runner.ts", "const k = process.env.OPENROUTER_API_KEY;");
    expect(rules()).toContain("env-declared-in-settings");
  });

  it("catches compose handing the container a variable nothing reads", () => {
    // The comment between the entries is the point. This file documents why
    // each variable is set where it is set, and an earlier version of this
    // check used one regex for the whole block — which stopped at the first
    // comment and quietly inspected only the names above it.
    write("docker-compose.yaml", [
      "services:",
      "  mra:",
      "    environment:",
      "      - MRA_MODEL=${MRA_MODEL}",
      "      # why this one is set the way it is",
      "      - MRA_GHOST_SETTING=${MRA_GHOST_SETTING}",
      "",
      "volumes:",
      "  mra_data: {}",
    ].join("\n"));
    expect(messageFor("env-declared-in-settings")).toContain("MRA_GHOST_SETTING");
  });

  it("stops at the end of the environment block", () => {
    // Keys under a later top-level section are not the container's environment.
    write("docker-compose.yaml", [
      "services:",
      "  mra:",
      "    environment:",
      "      - MRA_MODEL=${MRA_MODEL}",
      "  searxng:",
      "    environment:",
      "      - SEARXNG_SECRET=${SEARXNG_SECRET}",
    ].join("\n"));
    expect(rules()).not.toContain("env-declared-in-settings");
  });
});

describe("sqlite-migration", () => {
  it("catches a new column added only to CREATE TABLE", () => {
    // CREATE TABLE IF NOT EXISTS is a no-op against a database that already
    // exists, so this passes every test and fails at the first INSERT on the
    // VPS.
    write("server/src/store.ts", [
      "const SCHEMA = `",
      "CREATE TABLE IF NOT EXISTS research_runs (",
      "  id TEXT PRIMARY KEY,",
      "  totalTokens TEXT NOT NULL DEFAULT '',",
      "  packet_source TEXT NOT NULL DEFAULT ''",
      ")",
      "`;",
    ].join("\n"));
    expect(messageFor("sqlite-migration")).toContain("packet_source");
  });

  it("is satisfied by an ALTER TABLE in migrate()", () => {
    write("server/src/store.ts", [
      "const SCHEMA = `",
      "CREATE TABLE IF NOT EXISTS research_runs (",
      "  id TEXT PRIMARY KEY,",
      "  totalTokens TEXT NOT NULL DEFAULT '',",
      "  packet_source TEXT NOT NULL DEFAULT ''",
      ")",
      "`;",
      "const MIGRATIONS = [",
      "  ['packet_source', \"ALTER TABLE research_runs ADD COLUMN packet_source TEXT NOT NULL DEFAULT ''\"],",
      "];",
    ].join("\n"));
    expect(rules()).not.toContain("sqlite-migration");
  });

  it("does not ask for a migration on a brand-new table", () => {
    write("server/src/store.ts", [
      "const SCHEMA = `",
      "CREATE TABLE IF NOT EXISTS research_runs (",
      "  id TEXT PRIMARY KEY,",
      "  totalTokens TEXT NOT NULL DEFAULT ''",
      ")",
      "`;",
      "const MORE = `",
      "CREATE TABLE IF NOT EXISTS research_notes (",
      "  id TEXT PRIMARY KEY,",
      "  body TEXT NOT NULL DEFAULT ''",
      ")",
      "`;",
    ].join("\n"));
    expect(rules()).not.toContain("sqlite-migration");
  });
});

describe("dist-rebuilt", () => {
  it("catches a frontend source change with no rebuilt dist", () => {
    write("frontend/src/api.ts", "export interface Usage { totalTokens?: number }\n// edit");
    expect(rules()).toContain("dist-rebuilt");
  });

  it("is quiet once dist has been rebuilt alongside it", () => {
    write("frontend/src/api.ts", "export interface Usage { totalTokens?: number }\n// edit");
    write("frontend/dist/index.html", "<!doctype html>");
    expect(rules()).not.toContain("dist-rebuilt");
  });
});

describe("no-published-ports", () => {
  it("catches a published port in the VPS compose file", () => {
    // Docker writes its own iptables rules, so this is open to the internet
    // whatever ufw says.
    write("deploy/vps/docker-compose.yaml", [
      "services:",
      "  mra:",
      "    ports: [\"8000:8000\"]",
    ].join("\n"));
    expect(rules()).toContain("no-published-ports");
  });

  it("catches a locally published port bound to every interface", () => {
    write("docker-compose.yaml", [
      "services:",
      "  mra:",
      "    ports: [\"8080:8000\"]",
      "    environment:",
      "      - MRA_MODEL=${MRA_MODEL}",
    ].join("\n"));
    expect(rules()).toContain("no-published-ports");
  });

  it("allows the loopback-bound local mapping", () => {
    expect(rules()).not.toContain("no-published-ports");
  });
});

describe("the checker does not report its own fixtures", () => {
  // Every rule above is proved with a deliberately-bad fixture, so this file
  // holds one bad string per rule. Both `app-domain` and `no-secrets` used to
  // scan it and report themselves, which made the gate red on a clean tree and
  // trained everyone to ignore it. `scannable` in check-conventions.mjs excludes
  // this path; a rule added later must filter on it too.
  it("stays quiet about bad strings inside conventions.test.ts", () => {
    write(
      "server/tests/conventions.test.ts",
      [
        'write("README.md", "Live at https://chat.vanis.ai\\n");',
        'write("server/src/tools.ts", \'const key = "fc-0123456789abcdef0123456789abcdef";\');',
      ].join("\n"),
    );
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).not.toContain("app-domain");
    expect(rules()).not.toContain("no-secrets");
  });
});

describe("app-domain", () => {
  it("catches this app being given agentchat's address", () => {
    write("README.md", "Live at https://chat.vanis.ai\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).toContain("app-domain");
  });

  it("allows an old name on a line that also names the current one", () => {
    // The specs keep reversed decisions visible on purpose.
    write("README.md", "~~research.vanis.ai~~ now marketing.vanis.ai\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).not.toContain("app-domain");
  });
});

describe("no-secrets", () => {
  it("catches a committed .env", () => {
    write(".env", "OPENROUTER_API_KEY=x\n");
    git("add", "-f", ".env");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "oops");
    expect(rules()).toContain("no-secrets");
  });

  it("catches a key-shaped literal in a tracked file", () => {
    write("server/src/tools.ts", 'const key = "fc-0123456789abcdef0123456789abcdef";');
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).toContain("no-secrets");
  });

  it("does not flag an obviously fake placeholder", () => {
    write(".env.example", "FIRECRAWL_API_KEY=fc-your-key-here\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).not.toContain("no-secrets");
  });
});

describe("scans reach into subdirectories", () => {
  // server/src grew layers, and every scan here was a flat readdir. The
  // field-parity rule reported applied_count as missing while it sat in
  // src/domain/logs.ts, and the migration rule went silent when the schema
  // moved out of store.ts. Both now walk the tree.
  it("finds a client field declared in a nested server module", () => {
    write("frontend/src/api.ts", ["export interface Usage {", "  nested_field?: number;", "}"].join("\n"));
    write("server/src/domain/logs.ts", "export interface X { nested_field: number }\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).not.toContain("client-server-field-parity");
  });

  it("catches process.env read from a nested module", () => {
    write("server/src/agent/runner.ts", "const key = process.env.SNEAKY;\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x");
    expect(rules()).toContain("env-declared-in-settings");
  });
});
