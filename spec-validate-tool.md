# The contract as a tool — spec

Stage 1's contract is enforced once, at the exit, after every token has been paid
for. An agent cannot test a packet against it; it finds out by being rejected. Five
runs died that way this week, each 95% right:

| Run | Cost | Killed by |
|---|---|---|
| Mayaverra, review mining | — | `{"kind":"url","value":…}` on 19 excerpts — a locator shape the contract had no room for |
| Droplet | $0.017 | packet name vs a url brief |
| Toxin Rebellion | $0.028 | `other` vs `other` form — the validator was wrong, the agent was right |
| HappyWags | $0.065 | `"kind": "marketplace"` on 2 of 22 sources |
| HappyWags (earlier) | — | fences that did not pair, hiding a packet that was in the output |

Each was fixed on its own. The class was not. **The decision this spec records: the
validator becomes a tool the agent calls during the run, and the first packet that
passes is stored immediately.** A contract mismatch becomes a tool result to iterate
on, not a post-mortem.

Status: **built 2026-09-21**, except the retirements in §7, which wait on the
measurement each one names. §8 carries the checklist with what landed ticked.

---

## 1. The decision

> **`validate_packet` is a tool. The run's deliverable is the first packet that
> passes it. Everything after that is commentary.**

Three consequences, in increasing order of importance:

1. **Shape errors cost a tool call, not a run.** The agent reads
   `sources.3.kind: Invalid enum value … received 'marketplace'`, changes it, calls
   again.
2. **The agent can check early.** After two sources, when the packet is small and a
   correction is cheap — rather than at 140k tokens when it is 47k characters long.
3. **The packet is persisted the moment it validates.** A stream drop, a rate limit,
   a rambling final turn or a mangled fence after that point can no longer take it
   with them. Three of this week's five deaths were of packets that already existed.

What this does **not** change: the contract itself. `stagePacketSchema` stays
`.strict()`, the enums stay closed, the cross-object rules stay. The agent gets
iterations; the contract gives up nothing. That is the trade that makes it safe to
keep the validator strict — and `spec-stage-1.md`'s standing rule ("widen the schema
on purpose, do not loosen the validator") finally has an escape valve that is not
loosening.

---

## 2. The tool

```ts
// tools.ts, alongside web_search / web_fetch / the three Apify tools
{
  name: "validate_packet",
  label: "Check the packet",
  description:
    "Check a draft stage-1 packet against the contract. Returns valid, or the " +
    "exact problems to fix. Call it as soon as you have a few sources, and " +
    "again after each fix. The first packet that passes is the run's result — " +
    "emit that same packet as your final answer.",
  parameters: Type.Object({
    packet: Type.Unknown({ description: "The full stage-1 packet object, as JSON." }),
  }),
}
```

Tool parameters are pi-ai's `Type.*`, not zod — `tools.ts` declares every existing
tool that way (`searchParameters`, `fetchParameters`, …) and the provider needs a
JSON-schema shape. Zod stays where it belongs, validating the packet's contents
inside `validate()`.

Return shapes, as the model reads them:

```
VALID — this packet is the run's result. Emit it as your final answer, unchanged.
sources 22 · excerpts 16 · measurements 4 · gaps 15
```

```
NOT VALID — 2 problems. Fix exactly these and call again:
1. sources.3.kind: Invalid enum value. Expected 'first_party' | 'coa' | … , received 'marketplace'
2. excerpts.0.star_rating: Expected integer, received float
Checks used: 3 of 5.
```

The tool calls **the same `validate()`** the settle path calls, with the same `scope`
and `brief`. Not a second implementation — the failure mode of a mirrored validator is
that the two disagree and the agent is told its packet is fine and then rejected for
it.

**Wiring.** `createResearchTools()` gains one option so `tools.ts` keeps its current
property of not importing the store:

```ts
packetCheck?: {
  nodes: readonly Node[];
  brief: Brief;
  onValid: (packet: StagePacket) => void;   // runner persists it
}
```

---

## 3. Guards

Three, and the second is the one that keeps this honest.

1. **Bounded calls — five.** After that the tool returns
   `"check budget spent — emit your best packet as your final answer"` and stops
   validating. Prevents a loop where a model burns a run polishing JSON.
2. **Evidence may not shrink.** The obvious way to pass is to delete the offending
   source rather than fix its `kind`. So the tool remembers the high-water mark of
   `sources`, `excerpts`, `measurements` and `competitors` across calls, and refuses a
   draft that has fewer of any of them:
   `"this draft has 21 sources; an earlier draft had 22. Fix the problem, do not drop the evidence."`
   That refusal does not count against the budget — it is not a contract failure.
3. **Validation is not a licence to stop early.** A packet can be *valid* and thin:
   the gap list is mandatory and saturation is checked, but nothing stops a run
   validating after three sources and going home. The tool's VALID message therefore
   does not say "you are done"; it says "this is the run's result" and the node rules
   still govern when a node is complete. Watch the first runs for exactly this — a
   drop in sources-per-run after this ships is the signal it is being used as an exit.

---

## 4. Persisting on first pass

`onValid` fires inside the tool's execute, so the runner writes the packet mid-run:

```ts
// runner.ts, where the tools are built
packetCheck: {
  nodes, brief: request.brief,
  onValid: (packet) => {
    if (this.validated.has(run.id)) return;        // first pass wins
    this.validated.set(run.id, packet);
    this.store.updateRun(run.id, { packet, packet_source: "tool" });
    this.emit(run.id, "packet.ready", {
      sources: packet.sources.length,
      excerpts: packet.excerpts.length,
      gaps: packet.gaps.length,
      via: "tool",
    });
  },
}
```

**First pass wins, later passes are ignored.** The alternative — keep the last valid
packet — lets a model that validates early and then trims evidence overwrite a better
packet with a thinner one. Combined with guard 2, first-pass-wins means the stored
packet is the most complete one that ever passed.

### 4.1 What `settle()` does then

```
validated packet exists?
├─ yes → status `completed`. Do not extract, do not re-validate.
│        If the agent also errored or the stream died after validating, still
│        `completed`, plus event `run.ended_early {error}` — the deliverable exists
│        and is valid, and calling that run `failed` would be a lie about the
│        artefact even though it is true about the turn.
└─ no  → today's path exactly: extract() → validate() → completed / invalid / failed.
```

`invalid` keeps its meaning but narrows: *the agent never got a packet past the
validator within its budget*. That is a genuinely informative failure, which is what
the status was for.

---

## 5. Prompt changes

`prompt.ts`, in the OUTPUT block:

```
Check before you finish. Call `validate_packet` with your draft as soon as you
have a few sources, and again after each fix. It returns the exact problems.
The first packet that passes is this run's result — emit that same packet,
unchanged, as your final answer inside one fenced ```json block.
```

And the tool list in `systemPrompt()` gains a line, like the others. The worked
example **stays**: it teaches shape far faster than an error loop, and a first call
that fails on twelve problems is a worse start than one that fails on one.

See §7.5 for the prompt text that this *may* let us delete, and why not yet.

---

## 6. Telemetry — how we learn what to widen

Every problem string the tool returns is recorded:

```sql
CREATE TABLE IF NOT EXISTS research_packet_checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL,          -- 1..5
    valid      INTEGER NOT NULL,
    problems   TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);
```

This is how the enum question gets answered with evidence instead of argument: if
`kind: Invalid enum value … received 'marketplace'` shows up across five runs and
three products, `marketplace_listing` is a real missing kind and the schema widens on
purpose. If it appears once, it was one model's quirk and the loop already handled it.

Same for `form` and `other`, which `spec-stage-1.md` §2.2 leaves explicitly open.

---

## 7. What this makes redundant

The point of the decision is that it *removes* machinery rather than adding another
layer. Nothing here is deleted on day one — the fallback path is what protects runs
by a model that ignores the tool — but each item has a retirement condition.

### 7.1 `extract()` and its two scanners — demoted, then deletable

`fencedBlocks()`, `balancedObjects()` and the "last decodable candidate wins" loop in
[`packet.ts`](server/src/packet.ts) exist entirely to find a packet in prose. When the
packet arrives as a tool argument, there is no prose to search: the model hands us a
JSON object.

- **Day one:** keep, as the fallback for runs with no validated packet.
- **Retire when:** 20 consecutive runs record `packet_source = "tool"`. Then
  `balancedObjects()` goes first (it was added 2026-09-21 for one mangled-fence run),
  `fencedBlocks()` second, and `extract()` shrinks to "parse the argument".
- **Keep forever regardless:** the `run produced no output` guard.

### 7.2 `parse()` — already thin, becomes fallback-only

`parse(output, scope, brief)` is `validate(extract(output))`. In `src/` its only
caller is `settle()`, and only on the fallback branch, so it retires with §7.1 —
**except** for one caller worth keeping: `tests/prompt.test.ts` parses the worked
example out of the built prompt to prove the example itself validates. That test is
the reason the example has never drifted from the contract. If `parse()` goes, that
test moves to `validate(EXAMPLE)` rather than disappearing.

### 7.3 The repair ask — cancelled before it was built

Proposed 2026-09-21: on `invalid`, send the validation errors back for one tools-off
correction. **Do not build it.** It is this spec's mechanism, deferred to the worst
possible moment — after the model has stopped, with one attempt, no early check, and
no chance to fix the packet while the evidence is still being gathered. If
`validate_packet` ships, the repair ask has nothing left to do.

### 7.4 The packet nudge — narrows, does not go

`lacksPacket()` and `packetNudgeText()` handle "the run ended without emitting a
packet". With a validated packet already stored, that case cannot cost anything, so:

- skip the nudge entirely when a validated packet exists;
- keep it for runs that never called the tool and ended without a packet — a model
  ignoring one tool is exactly the model that ignores another instruction.

### 7.5 Parts of the OUTPUT prompt block — candidates, not yet

The field notes enumerate rules the validator now reports precisely:
`star_rating`/`axis` nullability, `posted_at` never null, the locator kinds, the
`nodes` entry per node, the non-empty gap list, `form`/`relation`, the two saturation
classes. Roughly 20 lines that exist because the agent got one shot.

**Do not trim them in the same change.** Trimming the prompt and adding the loop at
once makes the first measurement uninterpretable: more iterations could mean the loop
works or the prompt got worse. Ship the loop, measure the median call count for ten
runs, then trim and watch the same number. The `{example}` packet stays either way.

### 7.6 The "any key not in this schema is rejected and the run fails" line

Softens to "…and `validate_packet` will name it". It is the one line in the prompt
that is now *false* in spirit: a key not in the schema costs a tool call, not the run.

### 7.7 What is untouched

The retry/backoff policy, the salvage ask, `recover()`, the billing and pricing paths,
and everything in `spec_backup_llm.md`. Those handle **provider** failures. This
handles **contract** failures. Neither substitutes for the other, and a run can need
both in the same minute.

---

## 8. Implementation checklist

- [x] **`packet_source` column** (`"tool" | "output" | ""`) via the migration list in
      `store.ts`, plus `research_packet_checks`. Old rows read `""`.
- [x] **`validate_packet` tool** in `tools.ts` with the `packetCheck` option, the
      budget, the shrink guard, and both message shapes. Tests: a valid draft returns
      VALID and calls `onValid` once; an invalid one returns the problems verbatim;
      the sixth call refuses; a shrunken draft refuses without spending budget.
- [x] **Wire it in `runner.ts`**: build `packetCheck`, persist on first pass, emit
      `packet.ready {via: "tool"}`. Test: the packet is in the run row **before** the
      run ends.
- [x] **`settle()` short-circuit** + `run.ended_early`. Tests: a run that validates
      and then dies mid-stream is `completed` with the packet and the event; a run
      that never validates behaves exactly as today.
- [x] **Skip the nudge** when a validated packet exists. Test: no `run.nudged`.
- [x] **Prompt**: the OUTPUT instruction and the tool-list line. Test: the
      instruction is present, and absent for a run given no `packetCheck`.
- [x] **Cockpit**: `packet.ready` arriving mid-run already updates the counters; add a
      trace line for each check (`packet checked — 2 problems`) and a Model-row-style
      marker that the packet was validated in-run. A check that fails is not an error
      state in the UI — it is the loop working.
- [x] **Docs**: `workings.md` step 5 (the tool table) and step 6 (settle now has two
      paths); `spec-stage-1.md` §4.1 gains a note that the contract is enforced
      during the run as well as at the end.
- [ ] **Measure** (nothing to measure until real runs land): after ten runs, median checks per run, the distribution of problem
      strings (§6), and sources-per-run against the ten before (guard 3).

---

## 9. Non-goals

- **No auto-repair by the server.** The server never edits a packet to make it pass.
  A validator that fixes its own input is a validator that cannot be trusted to
  reject anything.
- **No partial acceptance.** A packet is valid or it is not. "Valid except for two
  sources" is how a contract becomes advisory.
- **No second validator for the tool.** One `validate()`, one truth.
- **No unbounded iteration.** Five checks. A model that cannot produce a conforming
  packet in five attempts has a problem no budget will fix.
