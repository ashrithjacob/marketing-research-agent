import { Type } from "@earendil-works/pi-ai";

export const searchParameters = Type.Object({
  query: Type.String({ description: "The search query." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many results to return (default 10, max 25)." }),
  ),
});

export const fetchParameters = Type.Object({
  url: Type.String({ description: "The absolute url to fetch." }),
});

export const recordParameters = Type.Object({
  item: Type.Unknown({ description: "The record, as one JSON object shaped like the example." }),
  entity: Type.Optional(
    Type.String({ description: "Who this is about: product, category, or a competitor id such as c3." }),
  ),
});

export const retractParameters = Type.Object({
  id: Type.String({ description: "The id a record_* call returned, e.g. ex14." }),
  why: Type.String({ description: "Why it is withdrawn." }),
});

export const finishParameters = Type.Object({});

export const findProductParameters = Type.Object({
  query: Type.String({ description: "Product name or phrase to search Amazon for." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many products to return (default 5, max 20)." }),
  ),
});

export const readLedgerParameters = Type.Object({
  agent: Type.Optional(Type.String({ description: "Only this agent's rows: champion, product, competitors or category." })),
  kind: Type.Optional(Type.String({ description: "Only rows of this kind, e.g. competitor_reference, attribute." })),
});

export const waitForParameters = Type.Object({
  agent: Type.String({ description: "The agent whose row you need: champion, product, competitors or category." }),
  kind: Type.String({ description: "The kind of row you need, e.g. attribute." }),
});
