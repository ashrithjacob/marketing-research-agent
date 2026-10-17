export const READ_REVIEWS = {
  name: "read_reviews",
  description:
    "Read the reviews customer voice mined for this product, a page at a time, lowest stars first: each with its ref, " +
    "star rating, date and text. `star` keeps one rating; `page` goes further.",
} as const;

export const RECORD_QUOTE = {
  name: "record_quote",
  description:
    "Record a customer's own words, by reference: either a review's `ref` (from read_reviews), or a page's `source_id` " +
    "and the paragraphs it spans (from web_fetch, [p12] to [p13] is from 12, to 13). Never type the words — code copies " +
    "them. `function` says what the words do: \"pain\", \"outcome\", \"objection\" or \"proof\" (the proof they demand); " +
    "`buyer_stage` where the person stands, if their words show it. Returns the quote's id (qt…) to cite.",
} as const;
