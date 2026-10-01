import { z } from "zod";

import { attributeSchema, excerptSchema, measurementSchema, sourceSchema } from "./evidence.js";
import {
  competitorReferenceSchema,
  competitorSchema,
  gapSchema,
  nodeStatusSchema,
  saturationSchema,
} from "./packet.js";
import type { Node } from "./nodes.js";
import {
  activeSchema,
  claimLimitSchema,
  doseStudySchema,
  mechanismSchema,
  operatorInputSchema,
  pricePointSchema,
  regimenSchema,
} from "./product-truth-rows.js";

export const FINDING_KINDS = [
  "source",
  "excerpt",
  "measurement",
  "attribute",
  "competitor",
  "competitor_reference",
  "saturation",
  "node_status",
  "gap",
  "active",
  "regimen",
  "mechanism",
  "dose_study",
  "claim_limit",
  "price_point",
  "operator_input",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

/** Kinds whose packet `id` is the ledger row's id, so the agent never invents one. */
export const CODE_ID_KINDS: ReadonlySet<FindingKind> = new Set(["excerpt", "measurement", "attribute"]);

export const FINDING_SCHEMAS: Readonly<Record<FindingKind, z.ZodTypeAny>> = {
  source: sourceSchema,
  excerpt: excerptSchema.omit({ id: true }),
  measurement: measurementSchema.omit({ id: true }),
  attribute: attributeSchema.omit({ id: true }),
  competitor: competitorSchema,
  competitor_reference: competitorReferenceSchema,
  saturation: saturationSchema,
  node_status: nodeStatusSchema,
  gap: gapSchema,
  active: activeSchema,
  regimen: regimenSchema,
  mechanism: mechanismSchema,
  dose_study: doseStudySchema,
  claim_limit: claimLimitSchema,
  price_point: pricePointSchema,
  operator_input: operatorInputSchema,
};

/** The node a kind with no `node` field of its own is filed under. The champion's reference has none: it belongs to every stage-1 run. */
export const FINDING_NODES: Readonly<Partial<Record<FindingKind, Node>>> = {
  competitor: "competitors",
  active: "dose_vs_study",
  dose_study: "dose_vs_study",
  mechanism: "mechanism",
  claim_limit: "claim_limits",
  regimen: "cogs_refills",
  price_point: "cogs_refills",
  operator_input: "cogs_refills",
};

export const FINDING_ROW_PREFIX: Readonly<Record<FindingKind, string>> = {
  source: "src",
  excerpt: "ex",
  measurement: "me",
  attribute: "at",
  competitor: "co",
  competitor_reference: "ref",
  saturation: "sat",
  node_status: "ns",
  gap: "gap",
  active: "ac",
  regimen: "rg",
  mechanism: "mx",
  dose_study: "ds",
  claim_limit: "cl",
  price_point: "pp",
  operator_input: "op",
};
