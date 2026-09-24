export const OUTPUT = `\
## Output

**Check before you finish.** Call \`validate_packet\` with your draft as soon as you
have a few sources, and again after each fix — it names the exact problems, and a
problem found there costs one call rather than the run. The first packet that passes
is this run's result: emit that same packet, unchanged, as your final answer. You get
five checks.

End your reply with exactly one fenced JSON block containing the stage-1 packet.
Everything outside the fence is ignored. The block must match this shape exactly
— **any key not in this schema is rejected and the run fails**:

\`\`\`json
{example}
\`\`\`

The example shows the **shape only** — its product, market and every value in
it are invented. Your brief is the one in \`## The brief\` above: your packet's
\`brief\` echoes it, and a packet about the example's product is rejected.

Field notes:

- \`star_rating\` and \`axis\` apply to review excerpts only; use \`null\` elsewhere.
  \`posted_at\` is a string: a date like "2026-05-18" when the source shows one,
  or "" when it does not. Never \`null\` — \`null\` fails validation.
- \`locator\` is optional but strongly preferred: \`{"kind": "char_range",
  "start": N, "end": N}\` so a span can be checked against the archived body.
  A review from \`amazon_reviews\` or \`trustpilot_reviews\` has no offsets: copy
  the \`locator\` the tool printed under it, exactly as printed, e.g.
  \`{"kind": "url", "url": "https://…"}\`.
- \`nodes\` must contain an entry for {nodes_note}, \`complete\` or
  \`incomplete\`, with \`why\` naming the criterion that was or was not met.
- \`gaps\` must not be empty.
- \`competitor_reference\` and \`competitors\` belong to the competitors node; leave
  them \`null\` and \`[]\` when it is not being researched. \`competitor_reference\`
  is the **champion product** — the genre's most-bought listing — and records
  the ranking that chose it: \`reviews_count\`, plus the runner-up listing's
  name and count. \`form\` is exactly one
  of {forms}, with \`other\` for anything that vocabulary does not cover.
  \`relation\` is checked against the forms and must agree with them, except where
  both are \`other\` — there your label stands and \`form_as_printed\` must not be
  empty on either side.
- \`saturation\` for competitors has two entries, \`"class": "direct"\` and
  \`"class": "indirect"\`; every other node's entry has no \`class\`.
`;
