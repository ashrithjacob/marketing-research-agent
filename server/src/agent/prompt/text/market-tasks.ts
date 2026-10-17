export const MARKET_SIZE_TASK = `## Your task: TAM and SAM, node \`tam_sam\`

Build the total addressable market upward, from population, prevalence and
willingness to pay, not downward from an industry report's headline: that figure
includes retail, ingredients this product does not sell and buyers it cannot
legally address. Then the serviceable part: the buyers this product can reach
through its channels, at its price, under the claim limits product truth found.
The SAM is usually a small fraction of the TAM, and it is the number that matters.
Use the category figures stage 1 recorded before searching for new ones.

{deliverable}`;

export const OFFERS_TASK = `## Your task: offers, node \`offers\`

Map what the direct competitors stage 1 found actually sell, as structure, not
judgement: where each anchors on price, per pack and per serving; subscription
discount depth; guarantee terms and length; free trials and samples; bundles; and
the funnel each uses (advertorial, long-form sales page, direct to product, quiz,
creator-led). Read their pages, which stage 1 already holds by id, before
fetching anything new. Then name the dominant pattern and the outliers. A
category where every serious player runs a ninety-day guarantee is telling you
about time to effect; one where nobody discounts subscriptions below fifteen
percent is telling you about margins: record what you see, and let the gate read
it.

{deliverable}`;

export const SOPHISTICATION_TASK = `## Your task: sophistication, node \`sophistication\`

Which of the five stages the market sits at, read off what competitors' ads
already have to do to persuade, never by feel. Each stage adds one element:

1. claim: a big, direct promise is enough.
2. amplifier: the promise made faster, bigger, easier, or "without" a downside.
3. mechanism: how it works, a unique reason it works where others did not.
4. proof: testimonials, UGC, customer counts, before and afters, demonstrations,
   experts, studies, celebrities: buyers have been burned and need risk taken away.
5. identity: buyers think they are the problem ("I'm too far gone"); ads shift
   that belief ("it's not your fault").

Tag every direct competitor ad or page you read with \`record_ad_elements\`: all
the elements it uses. Code counts the brands using each element; the stage is
the most advanced element at least half of them use, and \`finish\` checks yours
against that count. Then record the claims running, word for word, and how far
the leading claim has escalated and for how long (first-seen dates on the ads).
Cite the ads and pages stage 1 holds; search the ad library only for what they do
not cover.

{deliverable}`;

export const BREAKING_POINT_TASK = `## Your task: breaking point, node \`breaking_point\`

What makes someone start looking today rather than continuing not to. Not a
category of trigger ("stress", "new year") but the specific incident that made the
problem impossible to ignore: what someone was told, saw, could no longer do. Mine
them from the reviews customer voice kept, if it ran, and from forum and community
threads; these are events people report, not motives you infer, so each moment
cites where it was reported. Seasonality, if stage 1 found it, is the shallow
layer: record it, then go underneath it.

As you read them, tag every customer voice with \`record_buyer_stage\`: where that
person stands, from their own words. Someone who tried three brands and gave up is
a skeptic; someone who says nothing works for them is hopeless. Code counts the
stages: this is how sceptical the buyers are, beside what competitors' ads show.

{deliverable}`;

export const GATE_TASK = `## Your task: the viability gate, node \`viability\`

You run after the four market-truth agents. Their rows are below, beside what
product truth found. Judge each criterion "pass", "fail" or "unknown", then why,
citing the source of the deciding fact: size (is the SAM large enough for a
plausible revenue target at a plausible share), margin (does the margin at a price
the market accepts leave room for what the category pays to acquire a customer),
mechanism availability (at the sophistication stage found, is there a mechanism,
form or positioning not already taken), claim room (do the claim limits, given the
doses, still allow a proposition worth making), structural churn (does the refill
interval fit the time to effect). "unknown" is honest when an input is missing:
say what would settle it. Then the verdict: "go", "reposition" (one failed
criterion, generally: a different avatar, form or framing, using the adjacent
competitors as the options) or "drop" (two or more).

The landed unit cost is the owner's own figure, never research. If product
truth has none, margin is "unknown — needs the owner's landed unit cost": ask
for it, say at which prices it is judged, and do not search for a supplier
cost or treat its absence as a risk that could turn the verdict to drop. The
verdict rests on what research can settle.

{deliverable}`;
