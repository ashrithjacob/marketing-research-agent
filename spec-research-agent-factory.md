# One research agent, many roles — spec

**Status:** being built, see §13 · **Date:** 2026-10-03, revised the same day (`records`
derived, `contract` renamed `consistency`, §7 and §8 added) · **Parents:** `workings.md` (how a run
works), `spec-stage-1.md` §2 (what stage 1 delivers), `spec-stage-2-product-truth.md`
(what product truth delivers). Layer rules: `CLAUDE.md` and
`server/tests/architecture.test.ts`.

## 1. The problem

Every research agent in this app is the same machine — pi-agent-core's `Agent`,
a set of tools, a view of the run ledger, a check that `finish` runs, a turn
limit — configured for a **role**. Stage 1 has four roles (champion, product,
competitors, category); stage 2, product truth, has five (formula, mechanism,
dose_vs_study, claim_limits, cogs_refills).

The machine is built in two places that do the same eight steps:

| | Stage 1 | Stage 2 |
|---|---|---|
| Factory | `agent/stage-one-agent-factory.ts`, 128 lines | `agent/product-truth-agent-factory.ts`, 92 lines |
| Role settings | `STAGE_ONE_AGENT_SPECS` | `PRODUCT_TRUTH_AGENT_SPECS` |
| `finish` check | `DoneChecks.of` → `NodeDone` / `ChampionDone` | `ProductTruthDone` |
| At the turn limit | `LimitClose` | `TruthLimitClose` |
| Prompts | `PromptBuilder` | `ProductTruthPrompts` |

Three costs follow, each seen in practice:

1. **A capability added for "every agent" is added per stage.** Trendtrack's
   `ad_library_search` (2026-10-02) took five edits — a spec field, a factory
   branch, a toolset flag, a prompt-builder option, a prompt line — and stage 2
   still does not have it.
2. **Tools are switched on by boolean flags.** `ResearchToolset` takes
   `productSearch`, `evidence`, `discover` and `ads`, each an `if` inside it, and
   the system prompt has a matching placeholder per tool (`{amazon_search}`,
   `{discovery}`, `{ad_library}`). The house rules name this as a smell.
3. **What a role must deliver is written twice and kept in step by hand.** The
   ten product fields are `PRODUCT_ATTRIBUTES` in `domain/vocabulary.ts` (read by
   `finish`) and again a table in `PRODUCT_TASK` (read by the model); category
   likewise. Competitors' requirements are spread across zod defaults
   (`icp_as_printed: z.string().default("")`), `CompetitorIcp`, and a saturation
   rule that `finish` does not actually enforce: on run `f7b10adb` (Mullevia,
   2026-10-02) a curve ending in two quiet sources passed although the rule is
   three.

## 2. Goals and non-goals

**Goals**

- One `ResearchAgentFactory` builds any role's agent. A new stage writes role
  definitions, not a factory.
- A role is **declared**: its tools by name, what it may write, what it must
  deliver, its turn limit, its prompt text.
- **What a role must deliver is declared once**, with compulsory and optional
  fields, and everything else is derived from it: the field table in the
  prompt, the `finish` check, what the turn-limit closer gaps.
- Failures stay split by owner: transport in the driver, domain in the role's
  check, run-level in the supervisor.
- **What a run collected is shown however it ends** — completed, invalid,
  failed, cancelled, or killed by a restart — enforced by one ending path and a
  convention check, not by each ending remembering to (§7).
- **Every agent shows what it cost**: OpenRouter's billed LLM cost, and the
  Apify, Parallel, Trendtrack and page-reading spend of the tools it has, with
  a total per agent and for the run (§8).
- **No behaviour change in phase 1.** Every existing test passes unchanged.

**Non-goals**

- Merging `StageOneRun` and `ProductTruthRun`. They differ more (stage 2
  orders agents by dependency) and are a later spec. Their two settlements
  *are* merged, into `RunEnd` (§7), because the ending is where findings are
  lost.
- Giving every role every tool. Tools cost money and change behaviour
  (Mullevia: adding discovery cut the agent's own searching from 11–14 searches
  to 3); each role lists the tools it gets.
- A standalone product. Extract a library when a second consumer exists.
- Changing what any role researches.

## 3. The shape

```
domain/research-roles.ts        RoleSpec: tools, deliverable, consistency, maxTurns, waits   (data, no I/O)
domain/deliverable.ts           Deliverable: fields | list | per_item, with required/optional
        │
extract/deliverable-check.ts    DeliverableCheck: rows + deliverable → what is still missing   (pure)
        │
agent/tools/registry.ts         ToolRegistry: tool name → built tool, or nothing when its service is absent
agent/prompt/role-prompts/      RolePrompt per role: system role line, task text with {deliverable}
agent/prompt/deliverable-table  renders the deliverable as the prompt's field table
agent/role-done.ts              RoleDone: DeliverableCheck + the role's consistency check
agent/limit-close.ts            one LimitClose for every role (TruthLimitClose deleted)
agent/research-agent-factory.ts ResearchAgentFactory.build(role, run) → BuiltAgent
agent/built-agent.ts            BuiltAgent, moved out of the stage-1 factory
        │
AgentDriver (unchanged)  ─ retries, model fallback, turn limit
```

## 4. Domain: the role and its deliverable

### 4.1 `RoleSpec`

```ts
// domain/research-roles.ts
export const TOOL_NAMES = [
  "web_search", "web_fetch", "evidence_search", "evidence_fetch",
  "amazon_find_product", "discover_competitors", "ad_library_search",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const CONSISTENCY_CHECKS = ["stage_one_node", "champion", "product_truth"] as const;
export type Consistency = (typeof CONSISTENCY_CHECKS)[number];

/** Everything that makes one research agent different from another, except its prompt text. */
export interface RoleSpec {
  id: string;
  stage: 1 | 2;
  tools: readonly ToolName[];
  deliverable: Deliverable;
  consistency: Consistency;
  maxTurns: number;
  waitsFor: readonly string[];
}
```

- `tools` replaces the `amazon` / `discovery` / `ads` / `evidence` flags.
- `consistency` names the existing whole-part validation, which stays as it
  is (§6.3). It is the rules that compare rows with other rows or with the brief.
- There is **no `records` field**: the finding kinds a role may write are
  derived (§4.3), so a deliverable can never ask for a kind its role cannot write.
- `waitsFor` replaces "every stage-1 agent but the champion gets `wait_for`"
  and stage 2's `after` ordering input.

The two existing spec tables become one list of nine `RoleSpec`s, e.g.:

```ts
export const ROLES: readonly RoleSpec[] = [
  {
    id: "product", stage: 1,
    tools: ["web_search", "web_fetch", "ad_library_search"],
    deliverable: PRODUCT_DELIVERABLE, consistency: "stage_one_node",
    maxTurns: 15, waitsFor: ["champion"],
  },
  {
    id: "competitors", stage: 1,
    tools: ["web_search", "web_fetch", "discover_competitors", "ad_library_search", "amazon_find_product"],
    deliverable: COMPETITORS_DELIVERABLE, consistency: "stage_one_node",
    maxTurns: 20, waitsFor: ["champion"],
  },
  {
    id: "mechanism", stage: 2,
    tools: ["evidence_search", "evidence_fetch"],
    deliverable: MECHANISM_DELIVERABLE, consistency: "product_truth",
    maxTurns: 15, waitsFor: ["formula"],
  },
];
```

### 4.2 `Deliverable`: three shapes

Only two of the nine roles deliver a plain list of fields. The format has three
shapes, because three kinds of "done" exist today:

| Shape | Roles | Done means |
|---|---|---|
| `fields` | product, category, cogs_refills | every required field recorded or gapped |
| `list` | competitors | an open list, stopped by a rule (saturation), each item with required parts |
| `per_item` | formula, mechanism, dose_vs_study, claim_limits | a requirement for **each** thing another agent or the brief lists — each active, each market × platform |

```ts
// domain/deliverable.ts
export interface FieldSpec {
  key: string;
  record: "attribute" | "measurement";
  required: boolean;
  describe: string;
  rule?: FieldRule;
}

/** A requirement beyond "present": a closed set, checked by DeliverableCheck. */
export type FieldRule =
  | { kind: "distinct_periods"; min: number }
  | { kind: "picked_from"; ledgerKind: FindingKind; field: string };

export interface ItemPart {
  key: string;
  required: boolean;
  describe: string;
}

export type Deliverable =
  | { shape: "fields"; node: Node; fields: readonly FieldSpec[] }
  | {
      shape: "list";
      node: Node;
      item: FindingKind;
      classes: readonly string[];
      parts: readonly ItemPart[];
      stop: { kind: "saturation"; quietRun: number };
    }
  | {
      shape: "per_item";
      node: Node;
      over: { from: "ledger"; kind: FindingKind; by: string } | { from: "markets"; times: readonly string[] };
      needs: readonly { record: FindingKind; key: string; required: boolean; describe: string }[];
    };
```

**Two levels of "compulsory", kept apart.**

- **The deliverable** says which fields or parts this role must produce, and
  which are welcome but optional.
- **The zod schema of a row** (`domain/packet.ts`, `product-truth-rows.ts`)
  says what a row looks like: types, enums, formats. It stays where it is.
  Fields kept `.default("")` for old packets (`icp_as_printed`, `positioning_copy`)
  get their requiredness from the deliverable's `parts`, which is what
  `CompetitorIcp` does by hand today.

**Examples, written from what the code holds now:**

```ts
export const PRODUCT_DELIVERABLE: Deliverable = {
  shape: "fields", node: "product_data",
  fields: [
    { key: "name", record: "attribute", required: true, describe: "the name as the product's own page writes it, nothing appended" },
    { key: "brand", record: "attribute", required: true, describe: "the brand" },
    { key: "price", record: "attribute", required: true, describe: "price and currency for each pack size sold" },
    { key: "coa_present", record: "attribute", required: true, describe: "\"yes — <where>\" if a certificate of analysis is published, else \"no\"" },
    { key: "ad_activity", record: "attribute", required: false, describe: "how many Meta ads, which pages run them, first and last seen" },
    { key: "ad_claims", record: "attribute", required: false, describe: "the claims the ads make, word for word, separated by \" | \"" },
  ],
};

export const CATEGORY_DELIVERABLE: Deliverable = {
  shape: "fields", node: "category_data",
  fields: [
    { key: "search_volume", record: "measurement", required: true, describe: "searches per period, one row per period", rule: { kind: "distinct_periods", min: 3 } },
    { key: "category_size", record: "measurement", required: true, describe: "value as stated, currency and scale, the year it is for" },
    { key: "seasonality", record: "attribute", required: true, describe: "the months or season demand peaks, in the source's words" },
    { key: "meta_ads_matching", record: "measurement", required: false, describe: "Meta ads matching the customer's problem in the brief's markets" },
  ],
};

export const COMPETITORS_DELIVERABLE: Deliverable = {
  shape: "list", node: "competitors", item: "competitor",
  classes: ["direct", "indirect"],
  parts: [
    { key: "icp_as_printed", required: true, describe: "who its own page says it is for, word for word" },
    { key: "form_as_printed", required: true, describe: "what the product physically is, as printed" },
    { key: "price", required: false, describe: "price and currency" },
    { key: "positioning_copy", required: false, describe: "its headline, word for word" },
    { key: "ad_source_ids", required: false, describe: "its Meta ads, as ad_library sources" },
  ],
  stop: { kind: "saturation", quietRun: 3 },
};

export const MECHANISM_DELIVERABLE: Deliverable = {
  shape: "per_item", node: "mechanism",
  over: { from: "ledger", kind: "active", by: "name" },
  needs: [
    { record: "mechanism", key: "pathway", required: true, describe: "how the active acts, as a source states it" },
    { record: "mechanism", key: "time_to_effect", required: true, describe: "how long before an effect, as a source states it" },
  ],
};
```

The `fields` examples are abbreviated; the real lists carry all ten product
fields and the three category fields exactly as `PRODUCT_ATTRIBUTES` and
`CATEGORY_MEASUREMENTS` / `CATEGORY_ATTRIBUTES` hold them, which those constants
are then deleted in favour of.

### 4.3 Three settings, three questions

A role has three settings that are easy to confuse:

| Setting | Question | Checked when |
|---|---|---|
| **records** (derived) | what *kinds* of row may this agent write? | every write; a refused kind writes nothing |
| **deliverable** | what *content* must the ledger hold before it is done? | at `finish`, and at the turn limit |
| **consistency** | does what it wrote *add up* — citations real, labels agreeing with forms, markets in the brief, "complete" only with saturation? | at `finish` |

One category row through all three: `{"metric": "search_volume", "value":
301000, "period": "2026", "source_id": "sha256:ab12…"}`. **records**: a
`measurement` is a kind category may write, so it lands. **deliverable**: one
year is not enough for `search_volume` (rule: three distinct periods), so
`finish` asks for more or a gap. **consistency**: `sha256:ab12…` must be a source
the agent recorded; three years citing a page never recorded pass the
deliverable and fail here.

**`records` is derived, not declared:**

```ts
// domain/role-records.ts
/** The finding kinds a role may write: what its deliverable names, plus the bookkeeping its kind of part needs. */
export class RoleRecords {
  static of(role: RoleSpec): FindingKind[] {
    Trace.line(import.meta.url, "RoleRecords.of", { role: role.id });
    const named = Deliverables.kinds(role.deliverable);
    const status: FindingKind[] = role.consistency === "stage_one_node" ? ["node_status"] : [];
    const curve: FindingKind[] = role.deliverable.shape === "list" ? ["saturation"] : [];
    return [...new Set<FindingKind>(["source", ...named, ...curve, ...status, "gap"])];
  }
}
```

| Kind | Why |
|---|---|
| what the deliverable names | `measurement` and `attribute` for category, `competitor` for competitors, `mechanism` for mechanism |
| `source` | every role cites pages it read |
| `gap` | every role explains what it could not find |
| `saturation` | only a `list` deliverable: the curve that shows the list is complete |
| `node_status` | only stage-1 node roles report their part's status; stage 2 and the champion do not, today |

Phase 1 proves the derivation reproduces today's lists exactly: a test that
`RoleRecords.of` equals the `records` of every entry in `STAGE_ONE_AGENT_SPECS`
and `PRODUCT_TRUTH_AGENT_SPECS` before those tables are deleted.

## 5. Extract: `DeliverableCheck`

One pure class answers "what is still missing" for any deliverable. It replaces
`NodeFields.missing` (fields), the presence half of `ProductTruthCoverage`
(per_item), and `CompetitorIcp` plus the saturation count (list).

```ts
// extract/deliverable-check.ts
export interface Missing {
  key: string;
  text: string;
}

/** What a deliverable still lacks, from the rows in the ledger: a required field neither recorded nor gapped, a list not yet saturated, an item without a required part. */
export class DeliverableCheck {
  constructor(
    private readonly deliverable: Deliverable,
    private readonly markets: readonly string[],
  ) {}

  missing(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "DeliverableCheck.missing", { shape: this.deliverable.shape, rows: rows.length });
    switch (this.deliverable.shape) {
      case "fields":
        return this.fields(this.deliverable, rows);
      case "list":
        return this.list(this.deliverable, rows);
      case "per_item":
        return this.perItem(this.deliverable, rows);
    }
  }

  private fields(d: FieldsDeliverable, rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "DeliverableCheck.fields", { node: d.node });
    return d.fields
      .filter((field) => field.required && !Gaps.names(rows, d.node, field.key))
      .filter((field) => !FieldRules.satisfied(field, Rows.filling(rows, d.node, field)))
      .map((field) => ({ key: field.key, text: FieldRules.complaint(field) }));
  }
}
```

- `list` checks each live item has every required part non-empty, and each
  class's saturation curve ends in `stop.quietRun` consecutive sources adding
  nothing. That enforces the rule `finish` misses today.
- `per_item` expands `over` (the formula's actives from the ledger, or the
  brief's markets × the platforms) and checks every required need for each.
- Gap matching (`missing` starts with the key) and the three-year rule move
  unchanged from `NodeFields`.

Over 150 lines, it splits by shape into `FieldsCheck`, `ListCheck` and
`PerItemCheck` behind one `DeliverableCheck.of(deliverable)`.

## 6. Agent layer

### 6.1 `ToolRegistry`: tools by name

```ts
// agent/tools/registry.ts
/** Builds the tools a role names; a tool whose service is not configured is left out, not stubbed. */
export class ToolRegistry {
  constructor(
    private readonly services: ServiceClients,
    private readonly settings: Settings,
  ) {}

  build(names: readonly ToolName[], run: ToolContext): BuiltTool[] {
    Trace.line(import.meta.url, "ToolRegistry.build", { names });
    return names.flatMap((name) => {
      const tool = this.one(name, run);
      return tool ? [tool] : [];
    });
  }

  private one(name: ToolName, run: ToolContext): BuiltTool | null {
    Trace.line(import.meta.url, "ToolRegistry.one", { name });
    const corpus = new Corpus(this.settings.corpusPath);
    switch (name) {
      case "web_search":
        return { tool: new WebSearchTool(this.services.search).tool(), line: WEB_SEARCH_LINE };
      case "ad_library_search":
        return this.services.ads
          ? { tool: new AdLibraryTool(this.services.ads, corpus, run.runId).tool(), line: AD_LIBRARY_TOOL }
          : null;
      case "discover_competitors":
        return this.services.discovery && run.discoveryQuestion
          ? { tool: new DiscoverCompetitorsTool(this.services.discovery, run.discoveryQuestion, corpus, run.runId).tool(), line: DISCOVER_TOOL }
          : null;
    }
  }
}

export interface BuiltTool {
  tool: AgentTool<any>;
  line: string;
}
```

Each built tool carries its **own line for the system prompt**, so the prompt
lists exactly the tools the agent has. That retires the `{amazon_search}` /
`{discovery}` / `{ad_library}` placeholders and the flags that fill them. The
ledger tools (`record_*`, `retract`, `read_ledger`, `finish`, and `wait_for`
when `waitsFor` is not empty) are built as today, from `RoleRecords.of(role)`.

### 6.2 `RolePrompt`: text only

```ts
// agent/prompt/role-prompts/types.ts
export interface RolePrompt {
  role: string;
  task: string;
  briefing(context: RoleContext, live: readonly Finding[]): string[];
}
```

- `role`: the one-line "You are…" sentence (today `AGENT_ROLES` / `TRUTH_ROLES`).
- `task`: the task text, with a `{deliverable}` placeholder where the
  hand-written field table is today.
- `briefing`: the blocks a role needs from the ledger (stage 1's champion
  block; stage 2's "so far" packet). Both stages already build these from
  ledger rows, so the factory needs no stage-specific input.

`DeliverableTable.render(deliverable)` produces the table: compulsory fields
first, then optional fields under "May also be recorded", each with its
`describe` and, for a rule, its condition ("rows for at least 3 different
periods").

### 6.3 `RoleDone` and one `LimitClose`

```ts
// agent/role-done.ts
/** A role is done when its deliverable lacks nothing and its rows pass the consistency checks for their part. */
export class RoleDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly deliverable: DeliverableCheck,
    private readonly consistency: DoneCheck,
  ) {}

  problems(): CheckProblem[] {
    Trace.line(import.meta.url, "RoleDone.problems", { agentId: this.findings.agentId });
    const open = this.deliverable.missing(this.findings.live()).map((item) => CheckProblems.of(item.text));
    return [...open, ...this.consistency.problems()];
  }
}
```

`consistency` is today's validation minus the presence part: `NodeDone`'s
`PacketValidator` call for a stage-1 node, `ChampionDone`, `TruthCitations`.
`LimitClose` already does "retract rows that fail the check, gap what is open";
fed the role's `DeliverableCheck`, it serves both stages and `TruthLimitClose`
goes.

### 6.4 `ResearchAgentFactory`

```ts
// agent/research-agent-factory.ts
/** Builds the agent for any role: its tools by name, its prompt with the deliverable rendered in, its finish check, its turn limit. */
export class ResearchAgentFactory {
  constructor(
    private readonly store: ResearchStore,
    private readonly models: Models,
    private readonly tools: ToolRegistry,
    private readonly prompts: RolePrompts,
  ) {}

  build(role: RoleSpec, run: RoleContext): BuiltAgent {
    Trace.line(import.meta.url, "ResearchAgentFactory.build", { role: role.id, runId: run.runId });
    const findings = new RunFindings(this.store.findings, run.runId, role.id, [role.deliverable.node], run.markets);
    const check = new RoleDone(findings, new DeliverableCheck(role.deliverable, run.markets), ConsistencyChecks.of(role, findings, run));
    const budget = new TurnBudget(role.maxTurns);
    const steps = new ToolSteps();
    const built = this.tools.build(role.tools, { runId: run.runId, discoveryQuestion: DiscoveryQuestions.of(findings.live(), run.brief) });
    const ledger = LedgerTools.of(role, findings, check, run);
    const prompt = this.prompts.of(role.id);
    const agent = new Agent({
      streamFn: new LlmCallLog({ runId: run.runId, agentId: role.id, sequence: run.sequence, store: this.store, onCall: run.onCall })
        .wrap((m, c, o) => this.models.streamSimple(m, c, { ...o, onPayload: run.chain.withFallbacks(o?.onPayload) })),
      sessionId: `research-${run.runId}-${role.id}`,
      initialState: {
        systemPrompt: SystemPrompt.render(role, prompt, built, ledger),
        model: run.chain.current,
        tools: [...built.map((b) => b.tool), ...ledger].map((tool) => TracedTool.wrap(tool, steps)),
      },
      finishTurn: budget.finishTurn,
    });
    const instructions = Instructions.render(role, prompt, run, findings.live());
    const closeOnLimit = () => new LimitClose(findings, new RowRepair(this.store.findings, run.runId, [role.deliverable.node]), check, role).close();
    return { agent, instructions, steps, check, budget, closeOnLimit };
  }
}
```

`RoleContext` is the union of what both run contexts carry today (`runId`,
`brief`, `markets`, `chain`, `sequence`, `roster`, `onCall`, `onChecked`,
`onApifyCharge`, `judgements`, `rejectKinds`). `StageOneRun` and
`ProductTruthRun` keep their ordering logic and call `factory.build(role, run)`.

## 7. Showing what a run collected, however it ends

### 7.1 How the ledger works

The ledger is one SQLite table, `research_findings`
(`adapters/sqlite/finding-table.ts`): one row per finding — source, attribute,
measurement, competitor, gap — with the run, a sequence number, the row id
(`src3`, `co12`), its kind, the agent that wrote it, the source it cites, the
finding as JSON, and when it was written or retracted.

1. **Nothing is deleted or edited.** The port is `append`, `retract`, `list`
   (`domain/ports.ts`, `FindingLedger`). Withdrawing a row stamps
   `retracted_at` and a reason; the row stays for the audit.
2. **Every write is checked before it lands**, through `RunFindings.record`:
   its format and node scope (`FindingCheck`), and picks that must come from
   another row or the brief (`RowPicks`). A refused row writes nothing and the
   agent reads `NOT RECORDED — <why>` on the same turn.
3. **Rewriting replaces.** Each kind has a key (`Findings.key`): a competitor's
   `c3`, a node's status. The same key written again retracts the agent's own
   earlier row, "replaced by <new id>".
4. **Every agent reads everything and changes only its own rows.**
5. **At the end, the packet is assembled from the live rows**: `RowRepair`
   retracts each row a check complains about, with a gap naming it, so one bad
   row costs that row and not the run; `PacketAssembly` builds the packet the
   cockpit draws.

A row is in SQLite the moment it is written. An agent that fails, runs out of
turns or ends incomplete loses nothing. What decides whether the rows are
*shown* is how the **run** ends, after every agent has.

### 7.2 What happens today

An `invalid` run keeps its packet and the cockpit draws it under "Some checks
failed" (`RunSettlement.settleFromLedger`; `frontend/src/RunView.tsx`, which
draws any packet a run has, whatever its status). A `failed` run with rows does
too, and stage 2's `ProductTruthSettlement` likewise. Four endings lose what was
collected:

| Ending | What happens | Where |
|---|---|---|
| **The server restarts mid-run**, which every deploy does | the run is marked `failed` and the ledger is never assembled: the rows are in SQLite, no packet is made, nothing is shown | `RunSupervisor.recoverRunsKilledByRestart` |
| **Stop is pressed** | both settlements return `cancelled` before assembling | `RunSettlement.settle`, `ProductTruthSettlement.settle`, the `stopping` branch |
| **An exception escapes the run** — an agent throws past the driver, or settlement itself throws | the `catch` writes `failed` directly, without assembling | `StageOneRun` (`stage-one-run.ts`, the `catch` after `settle`), `ProductTruthRun` likewise |
| **The assembled packet does not parse** | the packet is `null`, so one row that will not parse hides every good row | `LedgerPacket.assemble` ("null only when it does not parse"), `productTruthPacketSchema.safeParse` |

A related fault: in `StageOneRun` the Amazon listing lookup
(`wrapUp.lookUpListings`) runs after settlement inside the same `try`, so if it
throws, the `catch` overwrites a `completed` run with `failed`. The packet
survives; the status is wrong. Work after the ending must not be able to change
it.

The factory cannot enforce this. It runs when an agent starts, before anything
is collected. The guarantee belongs to the one place a run ends.

### 7.3 One ending: `RunEnd`

```ts
// agent/run-end.ts
export type RunEnding =
  | { kind: "settled"; errorMessage?: string }
  | { kind: "stopped"; reason: string }
  | { kind: "crashed"; error: string }
  | { kind: "restarted" }
  | { kind: "refused"; error: string };

/** The only way a run reaches a final status: the ledger is assembled and stored first, so whatever the agents found is shown however the run ended; the status then says how it ended. */
export class RunEnd {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly assembly: RunAssembly,
  ) {}

  end(runId: string, ending: RunEnding): RunStatus {
    Trace.line(import.meta.url, "RunEnd.end", { runId, ending: ending.kind });
    const { packet, problems, retracted } = this.assembly.assemble(runId);
    if (packet) this.store.updateRun(runId, { packet, packet_source: "ledger" });
    const status = RunEnd.status(ending, packet !== null, problems);
    this.store.updateRun(runId, { status, error: RunEnd.error(ending, problems), ended_at: Clock.nowIso() });
    this.runs.emit(runId, `run.${status}`, { retracted: retracted.length, shown: packet !== null });
    return status;
  }
}
```

- **`RunAssembly`** is per stage (stage 1's `PacketAssembly` + `PacketValidator`,
  stage 2's `ProductTruthAssembly`), the only part that differs. The two
  settlements become two assemblies and one ending.
- **Assembly never returns `null` while live rows exist.** A row that will not
  parse is retracted into a gap naming it, as `RowRepair` already does for a row
  that fails a check, and the rest is assembled. `null` means an empty ledger
  and nothing else.
- **Status describes the ending; it never decides what is shown.**

| Ending | Rows in the ledger | Status | Packet shown |
|---|---|---|---|
| settled, no problems | yes | `completed` | yes |
| settled, problems | yes | `invalid` | yes, under "Some checks failed" |
| settled after a crash (`errorMessage`) | yes | `failed` | yes |
| settled after a crash | none | `failed` | nothing to show |
| stopped | any | `cancelled` | yes, if any |
| crashed (an exception escaped the run) | any | `failed`, "agent failed: …" | yes, if any |
| restarted | any | `failed`, "the server restarted…" | yes, if any |
| refused before start (unknown model; no stage-1 run for product truth) | none | `failed` | nothing to show |

Both runs' `catch` blocks call `RunEnd.end(id, { kind: "crashed", … })`. Work
that follows the ending (the listing lookup, billing) runs after `RunEnd` in its
own `try` and records its own error as an event; it never rewrites the status.

`recoverRunsKilledByRestart` calls `RunEnd.end(id, { kind: "restarted" })` for
each run it finds unfinished. It settles from the ledger and starts no model and
no paid tool, the same as `InvalidRunResettle` does for old invalid runs.

### 7.4 Keeping it that way

A new rule in `server/scripts/check-conventions.mjs`, **`run-ends-in-one-place`**:
a run's final status — `"completed"`, `"invalid"`, `"failed"` or `"cancelled"`
passed to `updateRun` — anywhere in `server/src` except `agent/run-end.ts` is
refused. Measured 2026-10-03, the places it would refuse today: `run-settlement.ts`
(4), `product-truth-settlement.ts` (5, through its `end`),
`review-mining-settlement.ts` (3, through its `end`), `stage-one-run.ts` and
`product-truth-run.ts` (1 each, the `catch`), `run-supervisor.ts` (1, restart),
`run-launcher.ts` (2, refused before start). A review *analysis* has a status of
its own (`review-analyst.ts`), not the run's, and is out of the rule's scope. It ships with a
test in `server/tests/conventions.test.ts` proving it catches a planted
violation. The restart path is the case this would have caught: it wrote
`failed` directly and nobody remembered it skips the ledger.

Review mining (stage 3) is a code pipeline with no agents. It keeps its own
ledger of fetched reviews (`agent/review-ledger.ts`), not `research_findings`.
Its run row is in scope for the rule, and its ending moves to `RunEnd` with a
`RunAssembly` that builds its packet from that review ledger.

## 8. What each agent costs

### 8.1 What is wanted

For every agent, and for the run:

| Column | Source of the figure |
|---|---|
| **LLM** | what OpenRouter billed, per model call (`/generation`) |
| **Apify** | what Apify charged, per actor run |
| **Parallel** | each call's usage, priced from Parallel's price list |
| **Trendtrack** | credits used, per request |
| **Page reading** | Firecrawl and Crawl4AI, per page |
| **Total** | the sum, per agent and for the run |

**Calculated LLM cost is dropped.** It is pi-ai's token counts × OpenRouter's
live prices (`agent/pricing.ts`), an estimate; the rail's "Calc cost", the
logs page's "calculated $" and `usage.cost` in the API go. The trade: billed
cost arrives about 4 s after each turn (`/generation` 404s until then,
`workings.md` §2a), so a live run shows "pending" for its last turn, where it
showed an estimate before.

A column appears only for a service the agent has a tool for. A role with no
Apify tool shows no Apify column, not $0.00; one with the tool that did not
spend shows $0.00.

### 8.2 Which agents can spend what

Derived from each role's `tools` through a fixed map, tool → service:

| Tool | Service | Unit |
|---|---|---|
| `web_search` | Parallel Search | 1 search |
| `evidence_search` | Parallel Search | 1 search |
| `evidence_fetch` | Parallel Extract, Crawl4AI behind it | 1 page |
| `web_fetch` | Firecrawl, Crawl4AI behind it | 1 page |
| `discover_competitors` | Parallel Task API | 1 run, priced by processor |
| `ad_library_search` | Trendtrack | 1 credit per ad returned |
| `amazon_find_product` | Apify | as Apify bills the actor run |
| every agent | OpenRouter | as billed per call |

| Agent | LLM | Apify | Parallel | Trendtrack | Page reading |
|---|---|---|---|---|---|
| champion | ✓ | ✓ `amazon_find_product` | ✓ search | — | ✓ |
| product | ✓ | — | ✓ search | ✓ | ✓ |
| competitors | ✓ | ✓ `amazon_find_product` | ✓ search, Task | ✓ | ✓ |
| category | ✓ | — | ✓ search | ✓ | ✓ |
| each stage-2 agent | ✓ | — | ✓ search, Extract | — | ✓ (Crawl4AI fallback) |
| **the run itself** (code, no agent) | — | ✓ listing lookup after stage 1; review mining | — | — | — |

The last row matters: code spends too. The Amazon listing lookup after a stage-1
run is about $0.01 per target (`spec-stage-2-pipeline.md` §3a) and belongs to no
agent, so the report has a **run** row beside the agents.

### 8.3 What each service tells us, measured 2026-10-03

| Service | Per call it reports | So the figure is | Today |
|---|---|---|---|
| OpenRouter | billed dollars, via `/generation` per `gen-…` id | **billed**, exact | stored per call with its `agent_id` (`research_llm_calls.billed_cost`) |
| Apify | dollars per actor run (`usageUsd`) | **billed**, exact | an `apify.charged` event per run, **with no agent** (`StageOneRun`, `RunWrapUp`, `ReviewMiningJob`) |
| Parallel | a usage count only, e.g. `[{"name":"sku_search","count":1}]` on a search; a Task run's result reports its `processor` and no usage | **listed price** × units; not billed | not recorded |
| Trendtrack | headers `x-credits-used: 1`, `x-usage-cost: 1`, `x-credits-remaining: 5779` | **credits**, exact; dollars only with a price per credit | not recorded |
| Crawl4AI | nothing; it is free (operator, 2026-10-03) | **$0**, pages counted | not recorded |
| Firecrawl | not measured here | pages counted, unpriced | not recorded |

Three consequences:

- **Parallel's figure is computed from its price list**, labelled "listed"
  in the report because Parallel returns units, not dollars: Search **$5 per
  1,000** ($0.005 a search; the tier our `sku_search` calls are charged at,
  confirmed by the operator 2026-10-03), Extract $1 per 1,000, Task `pro` $0.10,
  `ultra` $0.30 (`docs.parallel.ai` pricing, 2026-10-01).
- **Trendtrack is a plan allowance**: **$89 for 10,000 credits a month**
  (operator, 2026-10-03), so **$0.0089 a credit**, one credit per ad returned. The
  report shows credits and their dollar value; `MRA_TRENDTRACK_USD_PER_CREDIT`
  defaults to 0.0089, so a plan change is a config change. A default search of 10
  ads costs about $0.09.
- **Page reading** shows pages read by each reader. A page Crawl4AI read costs
  $0: it is free (operator, 2026-10-03). A page Firecrawl read is counted but
  unpriced until its per-page cost is measured. The reading order stays
  Firecrawl first, Crawl4AI behind it (operator's choice, 2026-10-03); with
  Firecrawl out of credits on both keys since 2026-10-02, every read currently
  falls through to Crawl4AI, so page reading is $0 in practice. A Firecrawl
  call refused with 402 is not a charge.

### 8.4 Design

One ledger of charges, written as they happen, each tagged with the agent
that caused it. The existing `MeteredActorRunner` (Apify) is the pattern: it
wraps a runner and reports each charge through a callback. Each paid service
gets the same wrapper.

```ts
// domain/charges.ts
export const COST_SERVICES = ["openrouter", "apify", "parallel", "trendtrack", "firecrawl", "crawl4ai"] as const;
export type CostService = (typeof COST_SERVICES)[number];

/** One thing a run paid for: billed where the service bills per call, priced from a list where it only counts. */
export interface Charge {
  run_id: string;
  agent_id: string | null;
  service: CostService;
  item: string;
  units: number;
  usd: number | null;
  basis: "billed" | "listed" | "credits";
}
```

- **Storage:** a new table, `research_charges`, one row per charge, written
  when the call returns. A new table, not new columns, so no migration of an
  existing table is needed.
- **Agent attribution:** `ToolRegistry.build(names, { runId, agentId, meter })`
  hands each tool a meter bound to its agent. Code that spends outside an agent
  (the listing lookup, review mining) writes with `agent_id: null`, which the
  report shows as **run**.
- **The wrappers:** `MeteredWebSearch` (Parallel units from `usage`),
  `MeteredDiscovery` (one Task run, priced by processor), `MeteredAdLibrary`
  (Trendtrack's `x-credits-used`), `MeteredPageFetcher`, and the existing
  `MeteredActorRunner` given the agent. Each adapter returns what the service
  reported; the wrapper turns it into a `Charge`. Prices live in `Settings`, so a
  price change is a config change.
- **LLM:** stays where it is (`research_llm_calls.billed_cost` per call); the
  report sums it by `agent_id`. When fewer turns are billed than were made, the
  cell says so ("billed 18 of 19 turns"), as `run.billed` already counts.
- **The report:** `GET /runs/:id/costs` returns one row per agent plus a run
  row, each with the columns its tools allow and a total, and a grand total. The
  cockpit shows it on the run rail, where "Calc cost" and "Billed" are now, and
  each agent's tab on the logs page shows that agent's row.

### 8.5 Worked example: run `1c0fcdd0` (Healora, competitors only, 2026-10-02)

What the run spent, from its event log and call log:

| Agent | LLM (billed) | Apify | Parallel (listed) | Trendtrack | Page reading | Total |
|---|---|---|---|---|---|---|
| champion | $0.0048 | in the run row ↓ | — (no search) | — | 1 page, Crawl4AI, $0 | $0.0048 |
| competitors | $0.0279 | in the run row ↓ | 4 searches $0.02 + Task `pro` $0.10 = $0.12 | — (no key then) | 12 pages, Crawl4AI, $0 | $0.148 |
| run | — | $0.010 (9 actor runs) | — | — | — | $0.010 |
| **Total** | **$0.0327** | **$0.010** | **$0.12** | — | **13 pages, $0** | **$0.163** |

Apify sits in the run row only because charges carry no agent today; with
§8.4 the champion's and competitors' `amazon_find_product` calls move to their
own rows and the listing lookup stays in **run**. The Parallel cell is the
largest and the only one not billed, which is why the "listed" label matters.

## 9. Failures: who owns what

| Failure | Example | Owner | Change |
|---|---|---|---|
| Model stream drops, model down | `terminated`, 429 | `AgentDriver.resumeDropped`: 3 retries, 2/4/8 s ± jitter, next model in `ModelChain` | none |
| Terminal model error | 402, invalid key, context too long | `Retries.isRetryable` refuses to retry | none |
| A tool's service fails | Parallel 402, Trendtrack no key, a 404 | the adapter throws; pi returns it to the model as a failed tool result | none; a tool whose service is not configured is not built (`ToolRegistry`) |
| Out of turns | limit reached, `finish` not passed | `AgentDriver.closeAtLimit` → `LimitClose`, now one class for every role | `TruthLimitClose` deleted |
| A row breaks its schema | wrong enum, missing type | `FindingCheck` at write time (zod) | none |
| A row breaks a role rule | competitor with no ICP; shared actives not from the list | at write time, `DeliverableCheck` on the row's item parts and `RowPicks` | `CompetitorIcp` folds into the list deliverable's `parts` |
| The deliverable is incomplete | field neither recorded nor gapped; class not saturated | `RoleDone` at `finish` | presence logic moves to `DeliverableCheck` |
| Spans agents | packet-wide rules, billing | `RunEnd` with a per-stage `RunAssembly` | the two settlements become one ending (§7) |
| The server restarts mid-run | a deploy | `recoverRunsKilledByRestart` → `RunEnd` | today it marks `failed` without assembling; now it shows what was found |
| Stop is pressed | operator | `RunEnd` | today nothing is assembled; now the packet is kept |

## 10. What is deleted, moved, kept

| Deleted | Replaced by |
|---|---|
| `agent/stage-one-agent-factory.ts`, `agent/product-truth-agent-factory.ts` | `ResearchAgentFactory` |
| `STAGE_ONE_AGENT_SPECS`, `PRODUCT_TRUTH_AGENT_SPECS` | `ROLES` |
| `ResearchToolset` flags `productSearch`, `evidence`, `discover`, `ads` | `ToolRegistry` and `RoleSpec.tools` |
| `{amazon_search}`, `{discovery}`, `{ad_library}` placeholders | each built tool's own prompt line |
| `PRODUCT_ATTRIBUTES`, `CATEGORY_MEASUREMENTS`, `CATEGORY_ATTRIBUTES`, `NodeFields.missing` | the `fields` deliverables and `DeliverableCheck` |
| hand-written field tables in `PRODUCT_TASK`, `CATEGORY_TASK` | `DeliverableTable.render` |
| `CompetitorIcp`; the unenforced saturation count | the `list` deliverable's `parts` and `stop` |
| presence half of `ProductTruthCoverage` | the `per_item` deliverables |
| `TruthLimitClose`, `DoneChecks.of`, `NodeDone`'s field check | `LimitClose`, `RoleDone` |
| the `records` lists in both spec tables | `RoleRecords.of(role)` |
| `RunSettlement`, `ProductTruthSettlement` (their ending logic) | `RunEnd`, with `RunAssembly` per stage |
| the `status: "failed"` written in `recoverRunsKilledByRestart` | `RunEnd.end(id, { kind: "restarted" })` |
| the `catch` blocks' direct `failed` in `StageOneRun`, `ProductTruthRun` | `RunEnd.end(id, { kind: "crashed", … })` |
| `ReviewMiningSettlement`'s ending | `RunEnd`, with a review-mining `RunAssembly` |
| calculated LLM cost: the rail's "Calc cost", the logs page's "calculated $", `usage.cost` in the API | billed cost only, per call and per agent (§8) |
| `apify.charged` events with no agent | `research_charges` rows with `agent_id`, or `null` for the run |

**Moved:** `BuiltAgent` to `agent/built-agent.ts`.

**Kept:** `AgentDriver`, `RetryPolicy`, `ModelChain`, `RunFindings`, the zod row
schemas, `PacketValidator`, `ChampionCheck`, `TruthCitations`, both runs.

## 11. Plan, in phases that each ship on their own

Each phase passes `mra check` and is seen working on one run before the next
starts (`CLAUDE.md` rule 4). Runs with competitors in scope spend Apify money:
ask first.

| Phase | Does | Proves it with |
|---|---|---|
| **0. One ending** | `RunEnd` and `RunAssembly`; restart and Stop go through it; assembly retracts unparseable rows instead of returning `null`; the `run-ends-in-one-place` convention rule and its test. Independent of the factory, smaller, and shippable first. | regression tests from each lost ending: a run with rows killed by a restart, a stopped run, a run whose agent team throws, a ledger with one unparseable row, each ending with its packet stored; and a listing lookup that throws after `completed` leaving the status `completed`. Then one no-Apify run stopped halfway, its packet shown in the cockpit. |
| **1. Factory** | `RoleSpec` (with `deliverable` still empty), `RoleRecords` (test: equals every current `records` list), `ToolRegistry`, `ResearchAgentFactory`, `BuiltAgent` moved; both factories and the toolset flags deleted; done checks and prompts unchanged | every existing test unchanged; one url brief on `product_data,category_data` whose tool calls and recorded fields match a run from before |
| **2. Costs** | `Charge`, `research_charges`, the metered wrappers, agent attribution through `ToolRegistry`; `GET /runs/:id/costs`; the rail and logs page show billed and per-agent costs; calculated cost removed | a test per wrapper that a call writes one charge with the right agent, service, units and basis; one no-Apify run whose per-agent LLM totals equal the sum of its billed calls and whose Parallel units equal its search count |
| **3. Fields** | product and category deliverables; `DeliverableCheck` (fields shape); `DeliverableTable` renders their tables; `NodeFields` and the constants deleted | a test that the rendered tables carry every key and description the hand-written ones did; the same no-Apify run |
| **4. List** | competitors deliverable; `CompetitorIcp` folded in; saturation's quiet run enforced at `finish` | a regression test from run `f7b10adb`'s curve (two quiet sources) being refused; one competitors run (Apify: ask) |
| **5. Per item** | stage-2 deliverables; `ProductTruthCoverage`'s presence logic and `TruthLimitClose` deleted | `product-truth.test.ts` unchanged; one stage-2 run on Mullevia (no Apify) |

## 12. Risks and open questions

- **One engine, every role.** After phase 1 a change to the factory, a tool or
  `DeliverableCheck` reaches all nine roles. Unit tests check wiring, not research
  quality; the Mullevia run is the example of a change that helped one brief
  and hurt another. **Before phase 4**, keep a small comparison over saved briefs
  (Healora, Mullevia, one genre brief) that prints per-role counts: fields
  filled, competitors, off-Amazon share, gaps.
- **`per_item` may not cover every rule.** `ProductTruthCoverage` also asks
  for one active marked `carrier`, which is "exactly one item has this value",
  not presence. Either `FieldRule` gains an `exactly_one` kind, or that check
  stays in the stage-2 consistency check. Decide in phase 5, from the code.
- **Saturation and discovered brands.** Run `f7b10adb`'s curve counted only
  pages that discovery had named. Whether sources reached through
  `discover_competitors` should count toward saturation needs a way to tell
  them apart (the tool that produced a source). Phase 4 decides; it is not
  assumed here.
- **Firecrawl's per-page cost** is not measured. It matters only once its
  credits are topped up; until then every read is Crawl4AI's, at $0.
- **The champion is a role with no node.** It files under `competitors` when
  that node is in scope (`StageOnePlans.nodeOf`). Its deliverable is the
  `competitor_reference` row; `consistency: "champion"` keeps `ChampionCheck`. Check
  in phase 1 that the `RoleSpec.deliverable.node` field works for it.

## 13. What was built, and where it differs from the above

**Phase 0 (2026-10-03).** `RunEnd` (`agent/run-end.ts`) with three assemblies:
`StageOneRunAssembly`, `ProductTruthRunAssembly`, `ReviewMiningRunAssembly`;
`StoredRunAssembly` rebuilds one for a run no process holds. `RunSettlement`,
`ProductTruthSettlement`, `ReviewMiningSettlement` and `LedgerPacket` are
deleted. The `run-ends-in-one-place` rule is in `check-conventions.mjs` with
three tests. Regression tests: `server/tests/run-end.test.ts`. Not yet seen on a
real run (no runs were made while building).

- A refused start is `RunEnd.refuse(runId, error)`, not a `refused` ending: it has
  no ledger, so it skips assembly rather than assembling nothing.
- `RunEnd` sets `ended_at` only when the run has none, so re-settling an old run
  (`InvalidRunResettle`, kept, now through `RunEnd`) keeps its end time.
- An unparseable row is tied to its ledger row by `RowBlame`
  (`extract/row-blame.ts`): the zod issue's path (`attributes.3.value`) indexes
  the same `LatestRows` list the packet was built from. A parse failure no row
  owns (the brief, say) still leaves the packet `null`.
- Assembly throwing is itself an ending: the run ends `failed`, "settling failed:
  …", instead of staying `running`.
- A settled run that ended early but whose ledger passes every check stays
  `completed` with a `run.ended_early` event, as before; the §7.3 table row
  "settled after a crash → failed" holds only when the ledger has problems.
- Judgement applications are now counted on any completed run, not only stage 1.
- A review-mining run killed by a restart still loses its reviews: they are held
  in memory until the end (`ReviewLedger`).
