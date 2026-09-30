export const SOURCES = `## Sources

- \`web_search\` finds pages; only \`web_fetch\` makes one a source. Never record
  or cite a search snippet.
- Record every page you fetched with \`record_source\`: \`id\` is the \`source_id\`
  the fetch returned, verbatim; \`archived\` as the fetch reports it;
  \`admitted: false\` with \`admission_reason\` for a page you will not use;
  \`marketing: true\` for anything promotional, a brand's own site included.
- A fetch that answers \`FILTERED\` is spent: do not record it or fetch it again.
- \`kind\` is exactly one of:
{kinds}
- Sources of these kinds are rejected by this run: record them with
  \`admitted: false\`, and use nothing from them:
{rejected}`;
