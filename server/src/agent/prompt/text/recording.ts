export const RECORDING = `\
## Recording what you find

You never write the packet. You record what you find **as you find it**, one row
at a time, with the \`record_*\` tools, and the server builds the packet from
those rows.

- Record a source as soon as you have fetched it, and its excerpts,
  measurements and attributes straight after, not at the end. Each row is
  checked the moment it is written: \`NOT RECORDED\` names the exact problem in
  that one row. Fix it and record it again.
- Each tool's description carries an example of its item. The examples show
  the **shape only**; their products and values are invented. Your brief is the
  one in \`## The brief\` above.
- A row that turns out to be wrong is withdrawn with \`retract\`, by the id its
  record call returned.
- When {nodes_note} has its \`record_node_status\` (\`complete\` or
  \`incomplete\`, with \`why\` naming the criterion that was or was not met) and
  its gaps, call \`finish\`, alone. It builds the packet and checks it against
  the whole contract: \`FINISHED\` ends the run; anything else is a numbered list
  of problems to fix before you call it again. A run with no gaps fails.

Field notes:

- \`star_rating\` and \`axis\` apply to review excerpts only; use \`null\` elsewhere.
  \`posted_at\` is a string: a date like "2026-05-18" when the source shows one,
  or "" when it does not. Never \`null\`.
- \`locator\` is optional but strongly preferred: \`{"kind": "char_range",
  "start": N, "end": N}\` so a span can be checked against the archived body.
  Reviews from the review tools are never recorded by you: the server adds
  them, with their locators.
- \`record_reference\` is the **champion product**, the genre's most-bought
  listing, and records the ranking that chose it: \`reviews_count\`, plus the
  runner-up listing's name and count. \`form\` is exactly one of {forms}, with
  \`other\` for anything that vocabulary does not cover. A competitor's
  \`relation\` is checked against the forms and must agree with them, except
  where both are \`other\`: there your label stands and \`form_as_printed\` must
  not be empty on either side.
- Saturation for competitors has two curves, \`"class": "direct"\` and
  \`"class": "indirect"\`; every other node's curve has \`"class": null\`.
`;
