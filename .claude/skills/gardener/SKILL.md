---
name: gardener
description: Use whenever the user corrects you, rejects a change, or you notice a workaround, duplicated code or a repeated mistake in marketing-research-agent. Turns the correction into the strongest guardrail that can hold it, so the same correction is never needed twice. Triggers on "no, don't", "again", "I told you", "stop doing", review feedback, or spotting a hack.
---

# Gardening

Agents extend what they find. One workaround left in the code becomes the
pattern everywhere within days, and a correction that only lives in chat will be
needed again. Your job is to make sure it can't be.

## The ladder: use the highest rung that works

1. **Make it impossible in the code.** Change a type, split a class, remove a
   parameter, so the wrong thing cannot be written. Example: a stage-1 packet has
   no field a judgement could go in, so an agent that wants to conclude something
   has nowhere to put it — stronger than a prompt asking it not to.
2. **Make it fail the gate.** Add a rule to `server/tests/architecture.test.ts`
   (shape) or `server/scripts/check-conventions.mjs` (specific bugs). Prove it
   fires: write the violating file, run `mra check`, watch it fail, delete it.
3. **Write it in `CLAUDE.md`**, under Code rules or Things that will bite you, as
   one line saying what to do instead.
4. **Put it in a skill**, but only if it is a procedure rather than a rule.

Go down a rung only when the higher one genuinely cannot express the rule, and
say which rung you used and why.

## Steps when corrected

1. Fix the instance the user pointed at.
2. Search for the same pattern elsewhere and fix those too, or list them if there
   are many.
3. Add the guardrail from the ladder.
4. Run `.claude/skills/mra-control/bin/mra check`.
5. Tell the user in one line: which rung, and which file holds it now.

## Standing weeds

- Comments in `server/src` and `frontend/src`: banned by the architecture test.
  Never reach for a directive comment to silence a real rule.
- Module-level functions, cross-layer imports, modules over 150 lines: banned by
  the same test.
- Anything added to the `LEGACY` list in that test. It only ever shrinks.
- "Temporary" fallbacks, silent `catch {}`, retries that hide a failure. Remove
  them and let the failure surface as a typed outcome.
- Two ways to do one thing. Delete the older one.
- A measured fact explained in a code comment. It belongs in a spec; the code
  keeps only the value.
