/**
 * The rulebook.
 *
 * `check-conventions.mjs` catches five specific bugs that were made here. This
 * file is the other half: the shape the code is being moved to, enforced as it
 * arrives rather than promised in prose.
 *
 * The conversion is staged, so every module that predates it is named in
 * `LEGACY` and exempt. That list is a ratchet — a file on it that has stopped
 * violating anything fails the suite until it is removed, so the exemption
 * cannot outlive the mess it covers. Never add to it.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

const SRC = new URL("../src", import.meta.url).pathname;
const MAX_MODULE_LINES = 150;

/** Layer → the layers it may import. A layer absent here may not be imported. */
const LAYERS: Record<string, readonly string[]> = {
  domain: [],
  config: [],
  extract: ["domain"],
  adapters: ["domain", "config"],
  agent: ["domain", "config", "extract", "adapters"],
  http: ["domain", "config", "extract", "adapters", "agent"],
};

/** A package may only be imported inside the layer that owns it. */
const PACKAGE_OWNERS: Record<string, string> = {
  "apify-client": "adapters",
  "better-sqlite3": "adapters",
  hono: "http",
  "@hono/node-server": "http",
  "@earendil-works/pi-agent-core": "agent",
  "@earendil-works/pi-ai": "agent",
};

/** Entry points, which exist to wire concrete things together. */
const WIRING = new Set(["main.ts", "hashpw.ts"]);

/**
 * Modules written before the conversion. Exempt from every rule below.
 * This list only ever shrinks; `the legacy list only shrinks` proves it.
 */
const LEGACY = new Set([
  "api.ts",
  "apify.ts",
  "app.ts",
  "auth.ts",
  "costs.ts",
  "http.ts",
  "packet.ts",
  "prompt.ts",
  "runner.ts",
  "schema.ts",
  "settings.ts",
  "store.ts",
  "tools.ts",
  "trace.ts",
]);

function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return name.endsWith(".ts") ? [relative(SRC, full)] : [];
  });
}

function parse(rel: string): ts.SourceFile {
  const text = readFileSync(join(SRC, rel), "utf8");
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
}

function layerOf(rel: string): string | null {
  const parts = rel.split(sep);
  return parts.length > 1 ? (parts[0] ?? null) : null;
}

function importsOf(file: ts.SourceFile): string[] {
  const out: string[] = [];
  file.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      out.push(node.moduleSpecifier.text);
    }
  });
  return out;
}

/** The layer an import resolves to, or null when it leaves the package. */
function targetLayer(rel: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const from = rel.split(sep).slice(0, -1);
  const parts = [...from, ...spec.split("/")].filter((p) => p !== ".");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.length > 1 ? (resolved[0] ?? null) : null;
}

function commentLines(rel: string, file: ts.SourceFile): number[] {
  const text = file.getFullText();
  const lines = text.split("\n");
  const directive = /^\s*\/\/\s*(@ts-|eslint|prettier)/;
  const found: number[] = [];
  let inBlock = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlock) {
      found.push(i + 1);
      if (trimmed.includes("*/")) inBlock = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      const oneLine = trimmed.endsWith("*/");
      if (!oneLine) {
        found.push(i + 1);
        inBlock = true;
      } else if (!trimmed.startsWith("/**")) {
        found.push(i + 1);
      }
      return;
    }
    if (trimmed.startsWith("//") && !directive.test(line)) found.push(i + 1);
  });
  return found;
}

function topLevelFunctions(file: ts.SourceFile): string[] {
  const out: string[] = [];
  file.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) out.push(node.name.text);
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          out.push(decl.name.getText(file));
        }
      }
    }
  });
  return out;
}

/** Every rule, as one function, so the ratchet can ask "is this file clean?". */
function violations(rel: string): string[] {
  const file = parse(rel);
  const found: string[] = [];
  const layer = layerOf(rel);

  if (layer === null && !WIRING.has(rel)) {
    found.push(`sits directly in src/ — every module belongs to a layer`);
  }
  if (layer !== null && !(layer in LAYERS)) {
    found.push(`is in unknown layer '${layer}'`);
  }

  const lines = file.getFullText().split("\n").length;
  if (lines > MAX_MODULE_LINES) {
    found.push(`is ${lines} lines, over the ${MAX_MODULE_LINES} limit`);
  }

  for (const line of commentLines(rel, file)) {
    found.push(`has a comment at line ${line}; names should carry the meaning`);
  }

  if (!WIRING.has(rel)) {
    for (const name of topLevelFunctions(file)) {
      found.push(`declares module-level function '${name}'; it belongs on a class`);
    }
  }

  for (const spec of importsOf(file)) {
    const owner = PACKAGE_OWNERS[spec] ?? PACKAGE_OWNERS[spec.split("/").slice(0, 2).join("/")];
    if (owner && layer !== owner && !WIRING.has(rel)) {
      found.push(`imports '${spec}', which only ${owner}/ may own`);
    }
    const target = targetLayer(rel, spec);
    if (target === null || layer === null || target === layer) continue;
    const allowed = LAYERS[layer] ?? [];
    if (!allowed.includes(target)) {
      found.push(`imports ${target}/, which ${layer}/ may not`);
    }
  }
  return found;
}

const FILES = sourceFiles();
const GOVERNED = FILES.filter((f) => !LEGACY.has(f));

describe("layers", () => {
  it("every governed module obeys every rule", () => {
    const failures = GOVERNED.flatMap((f) => violations(f).map((v) => `${f} ${v}`));
    expect(failures).toEqual([]);
  });
});

describe("the ratchet", () => {
  it("the legacy list only shrinks", () => {
    const stale = [...LEGACY].filter((f) => FILES.includes(f) && violations(f).length === 0);
    expect(stale, "these are clean now — delete them from LEGACY").toEqual([]);
  });

  it("names only files that exist", () => {
    expect([...LEGACY].filter((f) => !FILES.includes(f))).toEqual([]);
  });
});
