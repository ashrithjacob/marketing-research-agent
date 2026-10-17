# Goal

Read this before any change. If a change does not move one of the outcomes below,
or makes one of the principles false, it is the wrong change.

## The north star

**An e-commerce or Shopify owner gets the understanding a good marketing agency
and a GTM engineer would give them — of their product, their market and their
customer — and high-converting ads built on it, with deeper analysis than a
human-only process can afford to do.**

The system does the work an agency bills for: research, synthesis, angle
finding, ad writing, testing and reporting. The owner makes the judgement calls.

**Narrowed 2026-10-16, by the customer:** the product is an avatar research
tool for long-form statics. That means research, sophistication and awareness,
review mining, and avatars sliced from reviews, ads and the web. Positioning
and synthesis (outcome 4 below) are out. `docs/spec-avatar.md`.

## What "better than a human process" means here

A human team samples. It reads a few dozen reviews, a handful of competitor ads,
one or two category reports, and concludes. This system can read all of it,
keep every source, and show which source each conclusion came from. The
advantage is **coverage and traceability**, not speed alone:

- every claim on the screen links to the page, review or ad it came from;
- a conclusion says how much evidence it rests on, and where the evidence ran out;
- the work is repeatable: the same brief run next month shows what changed.

## The outcomes, in order

1. **Product truth** — what the product is, what it can legally claim, what it
   costs to make. (Stage 2.)
2. **Market truth** — who it competes with, what the market has already been
   sold, how sophisticated it is, where it breaks. (Stage 1, then market truth,
   code stage 4, with the viability gate: `docs/spec-market-truth.md`.)
3. **Customer truth** — who buys, in their own words: avatars, awareness, the
   language bank. (Review mining, stage 3.)
4. **Synthesis** — mechanism, claim ladder, positioning, the angle map.
5. **Ads that convert** — long-form statics and other formats written from the
   angle map, launched, measured, and the results fed back into 1–4.

The research compartment PDF (`research-compartment-supplement-mrr-v2.pdf`) is
the map of 1–4. The playbooks uploaded to the library are the method for 5.

## How it should work

- **Always on.** Not a button that runs a stage and stops. A standing operator
  per brand that watches for change, plans work, runs it, and comes to the owner
  only for decisions. `docs/spec-always-on.md`.
- **Evidence, never opinion.** Code checks what agents claim. A finding without
  a source is not a finding. `invalid` is information, not noise.
- **The owner steers; the system learns.** Every correction, rejection and
  approval is feedback, and the system gets measurably better from it without
  someone editing a prompt.
- **Knowledge comes from the owner's documents too.** Strategy PDFs and
  playbooks are uploaded once and every agent can read them.
- **Everything is async and streams.** Nothing blocks a request while work runs;
  every unit of work reports progress live to the dashboard.
- **Cost is billed, shown and bounded.** Every dollar spent is a measured
  charge, visible per agent, and money-spending work asks first.
- **Chat starts the work.** *Changed 2026-10-15, superseding the bullet below:*
  the app is one page, a chat beside the results. The owner names a product or
  pastes its page and asks; the operator starts the research. Only buttons and
  drafts are clickable, and a button is still the only way to approve anything
  that spends Apify money or changes what the system has learned.
  *2026-10-16:* the chat is the interface: every process runs from it, it
  guides the owner to the next step, and each stage starts from a brief the
  owner sees and edits, which becomes the research agents' prompt
  (`docs/spec-always-on.md` §11).
- ~~**Start, review, then chat.**~~ The owner starts with one button; the system
  answers with a plan of tasks to approve, and runs nothing before that. After
  that the owner guides the work by chatting with one operator, beside a
  dashboard of the work and its outcome. *Changed 2026-10-14:* this was "a
  dashboard, not a chat"; chat became the native way to steer, but a button,
  not a conversation, still starts the work, and nothing is hidden in the chat
  that the dashboard does not show.

## How we know it is working

- Ads produced by the system beat the owner's previous ads on their own
  numbers (cost per acquisition, return on ad spend).
- A finding's source can be opened in one click, and the source says what the
  finding says.
- Corrections given once are not needed again.
- A brief costs less, in dollars and in the owner's hours, than the agency
  retainer it replaces.
