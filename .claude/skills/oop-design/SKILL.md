---
name: oop-design
description: Use before writing or changing any TypeScript in server/src. Covers which layer a class belongs in, how to shape domain types and ports, constructor wiring, the frontend's separate rules, and regenerating the class diagram. Triggers on adding a feature, a class, a module, a refactor, or "where should this go".
---

# Adding code to marketing-research-agent

The goal is a codebase whose class diagram explains it: every class a box with
one job, arrows only to the layers its own allows. `server/tests/architecture.test.ts`
is the rulebook. If it and this file disagree, the file wins.

## Steps

1. **Name the data first.** A concept crossing a class boundary becomes a type or
   zod schema in `domain/`. Everything else depends on it, so it goes in first.
2. **Name the boundary.** Talking to anything outside the process — OpenRouter,
   Apify, SearXNG, SQLite, the corpus on disk — means an `interface` in
   `domain/ports.ts` and one adapter class in `adapters/` implementing it.
3. **Pick the layer** from the table in CLAUDE.md. If it fits none, stop and ask.
   Don't invent a layer to make it fit.
4. **Write the class.** Collaborators arrive through the constructor and are held
   `private readonly`. One or two public methods.
5. **Wire it in `http/app.ts`.** That and `main.ts` are the only places allowed to
   construct concrete adapters.
6. **Test it** against the interface with a fake, in `server/tests/`. A unit test
   never needs the network, a real SQLite file, or an API key.
7. **Run the gate**: `.claude/skills/mra-control/bin/mra check`.
8. **Regenerate the diagram** when classes or relationships changed:
   `node server/scripts/class-diagram.mjs` — it writes `docs/class-diagram.md`.

## Shape

```ts
export interface ReviewSource {
  fetch(asin: string, band: StarBand): Promise<ReviewPage>;
}

export class BandWalker {
  constructor(
    private readonly source: ReviewSource,
    private readonly policy: PolitenessPolicy,
  ) {}

  async walk(asin: string, band: StarBand): Promise<ReviewPage[]> { ... }
}
```

A class gets a one-line docstring only when its name cannot carry the meaning.
Prefer renaming.

## Smells to refuse

- A module-level function, a `utils.ts`, a `helpers.ts`. Find the class that owns it.
- A bare `dict`-shaped object crossing a layer. Give it a type in `domain/`.
- A `better-sqlite3` row or a `hono` `Context` escaping its layer.
- A base class with one subclass. Delete the base class.
- A boolean parameter that switches behaviour (`strict = true`). Make two classes.
- A comment. Rename until it isn't needed; if the reason is a measured fact, it
  belongs in a spec.

## The frontend is different

React function components are the paved path there; do not convert them to
classes. `frontend/src` rules:

- No comments. Same reason, same rule.
- A component file stays under 250 lines. Over that, extract a hook or a child.
- Data fetching and shaping live in `api.ts`; components render what they get.
- `api.ts` mirrors server field names **by hand and exactly** — camelCase where
  pi-ai produces it, snake_case where SQLite does. `check-conventions.mjs`
  enforces that every field the client declares exists in `server/src`.
