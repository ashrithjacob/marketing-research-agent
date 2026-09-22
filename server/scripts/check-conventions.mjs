#!/usr/bin/env node
/**
 * House rules for this repo, enforced rather than written down.
 *
 * Every check here exists because the mistake it catches was actually made and
 * cost a correction. A rule an agent can read is a rule an agent can skip; a
 * rule that fails `npm run check` is not. When you find yourself correcting the
 * same thing twice, the second correction belongs in this file.
 *
 *     node scripts/check-conventions.mjs          from server/, or anywhere
 *
 * Exit 0 = clean. Exit 1 = at least one violation, each printed as
 * `path:line  rule  what is wrong` so it can be acted on without a search.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Run every check against a repo and return what it found. Parameterised on the
 * root so the tests can point it at a fixture repo — a linter that quietly
 * matches nothing is the failure mode worth guarding against, and the only way
 * to know it still bites is to hand it the bug and watch.
 */
export function runChecks(REPO = DEFAULT_REPO) {
const violations = [];
const skipped = [];

function fail(file, line, rule, message) {
  violations.push({ file, line, rule, message });
}
function read(rel) {
  const p = join(REPO, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}
/** Line number (1-based) of the first line matching `needle`, else 1. */
function lineOf(text, needle) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  return i === -1 ? 1 : i + 1;
}
function git(...args) {
  try {
    return execFileSync("git", ["-C", REPO, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

// --- 1. the cockpit may only read fields the server actually sends ----------
//
// `frontend/src/api.ts` mirrors the server's JSON by hand. Both sides are
// TypeScript and neither checks the other, so a name that exists on only one
// side is not a type error — it is `undefined` at runtime. That is exactly how
// the cockpit sat on "Tokens —" for days: the server sent `totalTokens`,
// RunView read `usage.total_tokens`, and because the field was optional `tsc`
// had nothing to complain about.
//
// The invariant is not "camelCase" (most of this API is honestly snake_case,
// straight out of SQLite). It is: every field name the client declares must
// appear somewhere in server/src.
const CLIENT_ONLY_FIELDS = new Set([
  // Callback and option bags that live entirely in the browser and are never
  // parsed from a server response. Add a name here only after checking the
  // server genuinely does not send it.
  "handlers", "onEnd", "onError", "onEvent", "startRun", "stopRun",
  "logsUrl", "sourceUrl", "arguments", "toolCallId",
]);

function checkClientServerFieldParity() {
  const clientPath = "frontend/src/api.ts";
  const client = read(clientPath);
  if (!client) return skipped.push(`${clientPath} not found`);

  const serverDir = join(REPO, "server", "src");
  if (!existsSync(serverDir)) return skipped.push("server/src not found");
  const server = readdirSync(serverDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(serverDir, f), "utf8"))
    .join("\n");

  const lines = client.split("\n");
  lines.forEach((line, i) => {
    // A field declaration inside an interface or object type: indented,
    // `name:` or `name?:`. Not a top-level `export const x: T`.
    const m = /^\s{2,}([A-Za-z_][A-Za-z0-9_]*)\??:\s/.exec(line);
    if (!m) return;
    const field = m[1];
    if (CLIENT_ONLY_FIELDS.has(field)) return;
    if (new RegExp(`\\b${field}\\b`).test(server)) return;
    fail(
      clientPath, i + 1, "client-server-field-parity",
      `the client reads "${field}" but no file in server/src mentions it — ` +
      `it will be undefined at runtime and tsc will not say so. ` +
      `Fix the name, or add it to CLIENT_ONLY_FIELDS if it is browser-only.`,
    );
  });
}

// --- 2. every env var is declared in settings.ts ----------------------------
//
// settings.ts opens by promising "every env var this service reads is declared
// here". A `process.env.X` read anywhere else silently breaks that promise, and
// the var goes missing from the compose file and the deploy the day someone
// needs it.
function checkEnvDeclaration() {
  const serverDir = join(REPO, "server", "src");
  if (!existsSync(serverDir)) return skipped.push("server/src not found");

  for (const f of readdirSync(serverDir).filter((f) => f.endsWith(".ts"))) {
    if (f === "settings.ts") continue;
    const text = readFileSync(join(serverDir, f), "utf8");
    text.split("\n").forEach((line, i) => {
      if (!line.includes("process.env")) return;
      fail(
        `server/src/${f}`, i + 1, "env-declared-in-settings",
        "process.env is read outside settings.ts. Declare the variable in " +
        "Settings + loadSettings() and thread it through, so one file still " +
        "lists everything this service reads.",
      );
    });
  }

  // And the reverse: anything the compose file hands the `mra` container must
  // be a variable settings.ts actually reads, or it is dead config that looks
  // live.
  const settings = read("server/src/settings.ts");
  const compose = read("docker-compose.yaml");
  if (!settings || !compose) return;
  const mraBlock = compose.split(/^\s{2}mra:/m)[1];
  if (!mraBlock) return skipped.push("no `mra:` service in docker-compose.yaml");

  // Walk the environment block by indentation rather than matching it with one
  // regex: this file interleaves comments between the entries (they are the
  // best documentation of why each variable is set the way it is), and a regex
  // that stops at the first comment silently checks only the first few names —
  // which is exactly how this check passed while inspecting almost nothing.
  const envLines = [];
  const lines = mraBlock.split("\n");
  const start = lines.findIndex((l) => /^\s+environment:\s*$/.test(l));
  if (start === -1) return skipped.push("no environment block on the mra service");
  const indent = /^(\s+)/.exec(lines[start])[1].length;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    const depth = /^(\s*)/.exec(line)[1].length;
    if (depth <= indent) break;            // dedented out of the block
    if (line.trim().startsWith("#")) continue;  // a comment, not an entry
    envLines.push(line);
  }
  for (const m of envLines.join("\n").matchAll(/-\s+([A-Z][A-Z0-9_]*)=/g)) {
    const name = m[1];
    if (settings.includes(`"${name}"`)) continue;
    fail(
      "docker-compose.yaml", lineOf(compose, `- ${name}=`),
      "env-declared-in-settings",
      `the mra container is given ${name}, but settings.ts never reads it. ` +
      "Either read it there or drop it from the compose file.",
    );
  }
}

// --- 3. a new column needs a migration -------------------------------------
//
// `CREATE TABLE IF NOT EXISTS` is a no-op against a database that already
// exists, so adding a column to the CREATE statement does nothing to any
// machine that has run this code before — including the VPS. The failure does
// not appear at startup. It appears at the first INSERT, in production, as
// "table research_runs has no column named X".
function checkSqliteMigrations() {
  const rel = "server/src/store.ts";
  const now = read(rel);
  if (!now) return skipped.push(`${rel} not found`);
  const before = git("show", `HEAD:${rel}`);
  if (before === null) return skipped.push("no HEAD revision of store.ts to compare against");

  const columns = (src) => {
    const out = new Map(); // table -> Set(columns)
    for (const m of src.matchAll(
      /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\)/g,
    )) {
      const cols = new Set();
      for (const line of m[2].split("\n")) {
        const c = /^\s{2,}([a-z_][a-z0-9_]*)\s+(TEXT|INTEGER|REAL|BLOB|NUMERIC)/i.exec(line);
        if (c) cols.add(c[1]);
      }
      out.set(m[1], cols);
    }
    return out;
  };

  const oldCols = columns(before);
  const newCols = columns(now);
  for (const [table, cols] of newCols) {
    const had = oldCols.get(table);
    if (!had) continue; // a brand-new table needs no migration
    for (const col of cols) {
      if (had.has(col)) continue;
      const migrated = new RegExp(
        `ALTER TABLE ${table} ADD COLUMN ${col}\\b`,
      ).test(now);
      if (migrated) continue;
      fail(
        rel, lineOf(now, col), "sqlite-migration",
        `${table}.${col} is new in this change but has no ` +
        `"ALTER TABLE ${table} ADD COLUMN ${col} ..." in migrate(). ` +
        "CREATE TABLE IF NOT EXISTS will not add it to an existing database; " +
        "the first INSERT on the VPS will fail, not the startup.",
      );
    }
  }
}

// --- 4. a frontend change ships a rebuilt dist -----------------------------
//
// `frontend/dist` is tracked on purpose — the Docker image copies it. A source
// change without a rebuilt dist deploys the *old* UI while the diff says
// otherwise, which is the worst of both: nothing visibly broken, nothing
// actually changed.
function checkDistRebuilt() {
  const status = git("status", "--porcelain", "--", "frontend");
  if (status === null) return skipped.push("not a git repo — skipping dist freshness");
  const changed = status.split("\n").filter(Boolean).map((l) => l.slice(3).trim());
  const srcTouched = changed.filter(
    (p) => p.startsWith("frontend/src/") || p === "frontend/index.html",
  );
  const distTouched = changed.some((p) => p.startsWith("frontend/dist/"));
  if (srcTouched.length > 0 && !distTouched) {
    fail(
      "frontend/dist", 1, "dist-rebuilt",
      `${srcTouched.join(", ")} changed but frontend/dist did not. ` +
      "Run `cd frontend && npm run build` and commit dist — the deploy ships " +
      "dist, not src, so without it the change does not reach the browser.",
    );
  }
}

// --- 5. no port is published where ufw cannot see it -----------------------
//
// Docker writes its own iptables rules, so a `ports:` mapping is reachable from
// the internet whatever ufw says. On the VPS everything goes through Caddy on
// the shared network; locally, loopback-bound is fine and deliberate.
function checkPublishedPorts() {
  for (const rel of ["docker-compose.yaml", "deploy/vps/docker-compose.yaml"]) {
    const text = read(rel);
    if (!text) continue;
    text.split("\n").forEach((line, i) => {
      const m = /^\s*ports:\s*\[?\s*"?([^"\]\n]+)"?/.exec(line);
      if (!m) return;
      const mapping = m[1].trim();
      const loopback = mapping.startsWith("127.0.0.1:");
      const onVps = rel.startsWith("deploy/vps/");
      if (onVps) {
        fail(
          rel, i + 1, "no-published-ports",
          `publishes ${mapping}. On the VPS, Docker's own iptables rules ` +
          "bypass ufw, so this is open to the internet regardless of the " +
          "firewall. Use `expose:` and let Caddy reach it on the shared network.",
        );
      } else if (!loopback) {
        fail(
          rel, i + 1, "no-published-ports",
          `publishes ${mapping} on all interfaces. With no password set this ` +
          "hands anyone on your network an agent with web access. Bind it to " +
          "127.0.0.1.",
        );
      }
    });
  }
}

// --- 6. this app lives at marketing.vanis.ai -------------------------------
//
// It has been called research.vanis.ai and was once going to be a tab on
// chat.vanis.ai. Both names are still in the specs, correctly, as superseded
// decisions. What is not allowed is naming one of them *as this app's address*
// — so an old name is fine on a line that also names the current one.
function checkAppDomain() {
  const files = (git("ls-files") || "")
    .split("\n")
    .filter((f) => /\.(md|ts|tsx|yaml|yml)$/.test(f));
  for (const rel of files) {
    const text = read(rel);
    if (!text) continue;
    text.split("\n").forEach((line, i) => {
      if (!/\b(chat|research)\.vanis\.ai\b/.test(line)) return;
      if (line.includes("marketing.vanis.ai")) return; // contrast or correction
      fail(
        rel, i + 1, "app-domain",
        "names chat.vanis.ai / research.vanis.ai without naming " +
        "marketing.vanis.ai on the same line. This app is marketing.vanis.ai; " +
        "chat.vanis.ai is agentchat, a different app on the same VPS. Keep the " +
        "old name only where it is visibly superseded.",
      );
    });
  }
}

// --- 7. no secrets in tracked files ----------------------------------------
function checkSecrets() {
  const tracked = (git("ls-files") || "").split("\n").filter(Boolean);
  if (tracked.includes(".env")) {
    fail(".env", 1, "no-secrets",
      ".env is tracked by git. It holds OPENROUTER_API_KEY, FIRECRAWL_API_KEY, " +
      "APIFY_TOKEN and MRA_JWT_SECRET. Untrack it and keep it in .gitignore.");
  }
  // Key shapes, not variable names: an assignment whose value looks like a real
  // credential. `.env.example` placeholders are short and obviously fake.
  const patterns = [
    [/\bsk-[A-Za-z0-9_-]{20,}/, "an OpenAI/OpenRouter-style key"],
    [/\bfc-[A-Za-z0-9]{20,}/, "a Firecrawl key"],
    [/\bapify_api_[A-Za-z0-9]{20,}/, "an Apify token"],
  ];
  for (const rel of tracked) {
    if (/^(frontend\/dist|.*\.(png|jpg|pdf|ico|lock)$|package-lock\.json)/.test(rel)) continue;
    const text = read(rel);
    if (!text || text.length > 2_000_000) continue;
    text.split("\n").forEach((line, i) => {
      for (const [re, what] of patterns) {
        if (re.test(line)) {
          fail(rel, i + 1, "no-secrets",
            `looks like ${what} committed in a tracked file. Rotate it, then ` +
            "move it to .env (gitignored) and read it through settings.ts.");
        }
      }
    });
  }
}

const checks = [
  ["client-server-field-parity", checkClientServerFieldParity],
  ["env-declared-in-settings", checkEnvDeclaration],
  ["sqlite-migration", checkSqliteMigrations],
  ["dist-rebuilt", checkDistRebuilt],
  ["no-published-ports", checkPublishedPorts],
  ["app-domain", checkAppDomain],
  ["no-secrets", checkSecrets],
];

for (const [, fn] of checks) fn();
return { violations, skipped, count: checks.length };
}

// --- CLI -------------------------------------------------------------------
// Guarded, so `import { runChecks }` in the tests does not run the CLI and call
// process.exit() out from under vitest.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { violations, skipped, count } = runChecks(process.argv[2] ?? undefined);

  if (violations.length === 0) {
    console.log(`conventions: ${count} checks, clean`);
    for (const s of skipped) console.log(`  (skipped: ${s})`);
    process.exit(0);
  }

  console.error(`conventions: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(`${v.file}:${v.line}  [${v.rule}]`);
    console.error(`  ${v.message}\n`);
  }
  console.error(
    "Each of these is a mistake that was made here before. If one is wrong, fix " +
    "the rule in server/scripts/check-conventions.mjs — do not work around it.",
  );
  process.exit(1);
}
