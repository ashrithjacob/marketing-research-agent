export const EXCERPT_RECORD = {
  name: "record_excerpt",
  kind: "excerpt",
  description:
    "Record a quote from a page you fetched, by reference: give its source_id and the numbers of the paragraphs it spans, " +
    "as web_fetch showed them ([p12] to [p13] is from 12, to 13). Do not type the quote out — the exact text and where it " +
    "sits are copied from the archived page for you. Record the page with record_source too. The id is assigned for you.",
} as const;
