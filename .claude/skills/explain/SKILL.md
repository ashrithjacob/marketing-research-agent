---
name: explain
description: Explain a code change, or any part of marketing-research-agent, to a reader who knows nothing about the code — as a published interactive web page with diagrams, a narrated step-through, annotated code and plain controlled-language prose. Use when the user types "explain to me …", runs /explain, or asks to be walked through what a change did and how it works.
---

# Explain it to someone who knows nothing

The reader is the owner of this app. They direct the work but do not read the
code. Assume they know nothing: not the file layout, not the words we use
("packet", "node", "champion", "run end"), not TypeScript. Your job is that
after one page they can say, in their own words, **what changed, why, and how
it works**, and can check one claim themselves.

The output is a web page, published with the Artifact tool. Prose alone is the
weakest format for this reader; a picture plus a walk-through is the strongest.

## 1. Decide the subject

- `/explain <topic>` or "explain to me <topic>": the topic is the subject.
- No topic, or "explain to me what you did / this change": the subject is the
  latest change. Read it, in this order, and stop at the first that is non-empty:
  1. what this conversation changed (you know it; name the files),
  2. `git diff HEAD --stat` and `git status --short` (uncommitted work),
  3. `git show --stat HEAD` (the last commit).
- A large diff is several stories. Group files by **the behaviour they change**,
  not by folder. One page explains one to four stories. If there are more, say
  which ones you left out in the terminal reply.

## 2. Learn it before you explain it

Verify, don't assert — the repo rule applies to explanations too.

- Read the changed code, and the code that calls it. Read `git diff` hunks, not
  only file names.
- Use the repo's own maps for the context around the change:
  `FEATURE_MAP.md` (what is on the screen and which endpoint it calls),
  `workings.md` (how a run works end to end), `workings_stage1.md` (why stage 1
  is four agents), `docs/class-diagram.md` (classes and who holds whom),
  `server/tests/architecture.test.ts` (the layers).
- Every claim on the page carries its source as `file:line`. Every number says
  where it came from and how it was measured. If you did not measure it, write
  "not measured" — never round a guess into a fact.
- To show behaviour, prefer what already exists: a test that proves it
  (`npx vitest run <file>`), `mra calls`, a stored run. Never start a run that
  spends Apify money for an explanation (CLAUDE.md rule 5). A url brief on
  `product_data,category_data` is the cheap one, and only if the user asks.

## 3. Shape the page

Build these sections, in this order. Each one is short. Leave out a section
only when it has nothing true to say.

1. **One sentence.** What is different now, from the point of view of a person
   using the app. No code words.
2. **Where this lives.** An SVG map of the system (browser → `http` routes →
   `agent` run loop → `adapters` → outside services such as OpenRouter,
   Parallel, Apify, the store). Highlight the boxes this change touches. Every
   box gets a one-line plain label under its code name.
3. **Before and after.** A toggle between two versions of the same diagram or
   flow. The reader clicks and sees what moved.
4. **Walk one example through.** A concrete case ("a brief for *magnesium
   glycinate*, UK") followed step by step. This is the step-through player:
   numbered scenes, Back / Next / Play, each scene a highlighted diagram state
   plus two or three sentences. Play advances automatically and reads each
   scene aloud with the browser's built-in `speechSynthesis` (free, local, no
   key); a mute toggle; it must work silently too.
5. **The code, annotated.** The two to five hunks that matter, as code panels.
   Beside each, numbered notes in plain words saying what each marked line
   does. Show real code, trimmed with `…`, with its `file:line`. Never invent
   code to make the point clearer.
6. **Why it was built this way.** The design reason, and the option that was
   not taken. Take it from the specs and the conversation, not from your own
   guess.
7. **See it yourself.** One to three things the reader can do to watch it work:
   a screen in the cockpit and what to look for, or one `mra` command and the
   line of output that proves it.
8. **Check your understanding.** Three questions, each with a hidden answer the
   reader reveals with a click. Ask about mechanism ("what happens if…"), not
   vocabulary.
9. **Words used on this page.** A glossary of every technical term. In the body,
   the first use of each term is underlined and shows its definition on hover
   or tap.

## 4. Write in controlled English

Write about 80% of the way to ASD-STE100 (Simplified Technical English). These
are its rules that matter most here:

- One idea per sentence. Descriptive sentences: at most 25 words. Steps: at
  most 20 words, and one action per step.
- Active voice. Simple present tense. Name who does the action: "The run loop
  calls the store", not "the store is called".
- One word, one meaning. If the code says "packet", always say "packet" — never
  "result", "output" and "report" for the same thing.
- Define a technical word the first time you use it. Spell out every
  abbreviation the first time (LLM = large language model).
- No idioms, no metaphors that need decoding, no phrasal verbs where a plain
  verb exists ("start", not "kick off").
- Keep articles ("the", "a"). Use lists and tables for steps and comparisons.
- Explain the mechanism, not the name of the mechanism (CLAUDE.md rule 1).

## 5. Build and publish

1. Call `Artifact` with `action: "quickstart"`, `intent: "other"`, then load the
   `artifact-diagramming` skill. Follow both for the page contract (title,
   colour tokens, dark mode, phone width, allowed CDNs).
2. Write the page to the scratchpad directory as
   `explain-<yyyy-mm-dd>-<slug>.html`. One self-contained file; inline SVG; no
   external images. Diagrams are hand-built SVG with real names from the code.
3. Publish it with `icon: "lightbulb"` and a one-sentence `description`.
4. If the user asks a follow-up about the same subject, edit the same file and
   republish to the same URL. A new subject gets a new page.

## 6. The terminal reply

The page is the answer. The terminal reply is:

- the link,
- the one sentence from section 1,
- three to five lines of controlled-English summary,
- one line naming anything you could not verify or left out.

Do not repeat the page in the terminal.
