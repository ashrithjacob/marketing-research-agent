export const VOICES_TASK = `## Your task: the language bank, node \`language_bank\`

The literal phrasing buyers use, kept verbatim and sorted by what it does: how
they describe the **pain**, the **outcome** they want, the **objections** they
raise, the **proof** they demand before believing anything. "I wake up at 3am and
can't get back to sleep" is usable; "sleep issues" is not. Keep the specific
detail: times, situations, the remedies that failed.

Read the reviews first, 1 and 2 stars before 3, 4 and 5. Record each phrasing
worth writing from with \`record_quote\`, and where the words show it, the buyer's
stage. Then search forums and review threads for what the reviews miss. Stop when
new reviews and threads stop giving new phrasings, not at a count.

{deliverable}`;

export const IDENTITY_TASK = `## Your task: the identity layer, node \`identity\`

What sits under the words. Find, each from a voice:

- **label_self**: what buyers call themselves ("the one who's always coughing").
- **label_others**: labels others gave them that still sting, often a doctor's or
  a family member's.
- **guilt**: what they blame themselves for, or are ashamed of.
- **loss**: what the problem has cost them: an activity, a role, a relationship.
- **feared_identity**: who they are afraid of becoming, often someone they watched.

Record the quote first with \`record_quote\`, then the entry with
\`record_identity_entry\`, a short summary in your words citing the quote ids.
Then, for each major pain, \`record_pain_profile\`: the emotion (fear, guilt,
shame, grief, anger, helplessness), its intensity, whether it is acute, chronic
or episodic, and whether it is private, visible to others, or straining a
relationship. This is the easiest place to write fiction: every line needs a
voice, or it is \`inferred\`.

{deliverable}`;

export const AVATARS_TASK = `## Your task: the avatars, node \`avatars\`

Two to four avatars, each with its sub-avatars, from the quotes, identity entries
and pain profiles below. Build each on three axes, in this order:

1. **situation**: what is happening in their life that brings them here;
2. **history**: what they have already tried, and how it failed them. This is
   the most predictive axis for supplements: someone who tried four products
   needs a different argument from a first-time buyer of the same age;
3. **demographics**, last.

Each carries its pains, outcomes, objections, the identity it holds about
itself, its **secondary gain** (what having the problem quietly gives them, and
what they would give up to solve it) and its **blame** (outward: an industry, a
doctor; inward: their own discipline; or mixed). A sub-avatar is an avatar with
\`parent\` set. Look for **proxy buyers** (a parent buying for a child, an adult
child for a parent, a partner) and record whether you found them in
\`proxy_buying\`; a proxy buyer is its own avatar with \`proxy\` true. Cite quote
ids for every avatar.

{deliverable}`;

export const AWARENESS_TASK = `## Your task: awareness, node \`awareness\`

For each top-level avatar below, on each channel (cold_social, category_search,
branded_search, marketplace, retargeting), how aware they are when they arrive
from it: a weight on each of the five levels (unaware, problem_aware,
solution_aware, product_aware, most_aware) summing to 1, and the entry level to
write for. The same avatar arrives problem-aware from a cold ad and product-aware
from a branded search. Say why in one line, citing the quotes that show it, or
mark it inferred.

{deliverable}`;
