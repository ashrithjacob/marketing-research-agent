import type { FieldSpec, FieldsDeliverable } from "./deliverable.js";
import { Trace } from "../trace/index.js";

/** The customer-truth fields that are one row kind filtered by one of its fields: a quote by its function, an identity entry by its kind. */
class CustomerFields {
  static quote(fn: string, brief: string): FieldSpec {
    Trace.line(import.meta.url, "CustomerFields.quote", { fn });
    return { key: fn, record: "quote", required: true, brief, describe: `\`record_quote\` with \`function\` "${fn}": ${brief}, by review ref or page paragraphs`, rule: { kind: "where", field: "function", value: fn } };
  }

  static entry(kind: string, required: boolean, brief: string): FieldSpec {
    Trace.line(import.meta.url, "CustomerFields.entry", { kind });
    return { key: kind, record: "identity_entry", required, brief, describe: `\`record_identity_entry\` with \`kind\` "${kind}": ${brief}, citing the quotes that show it`, rule: { kind: "where", field: "kind", value: kind } };
  }
}

export const VOICES_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "language_bank",
  fields: [
    CustomerFields.quote("pain", "how buyers describe the pain, in their words"),
    CustomerFields.quote("outcome", "the outcome they want"),
    CustomerFields.quote("objection", "what they object to, or what put them off"),
    CustomerFields.quote("proof", "the proof they demand before believing anything"),
  ],
};

export const IDENTITY_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "identity",
  fields: [
    CustomerFields.entry("label_self", true, "what buyers call themselves in this market"),
    CustomerFields.entry("label_others", false, "labels others gave them that still sting"),
    CustomerFields.entry("guilt", true, "what they blame themselves for, or are ashamed of"),
    CustomerFields.entry("loss", true, "what the problem has cost them"),
    CustomerFields.entry("feared_identity", true, "who they are afraid of becoming"),
    { key: "pain_profiles", record: "pain_profile", required: true, brief: "for each major pain: the emotion, its intensity, duration and social side", describe: "`record_pain_profile`, one per major pain, citing the quotes" },
  ],
};

export const AVATARS_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "avatars",
  fields: [
    { key: "avatars", record: "avatar", required: true, brief: "2 to 4 avatars, each with sub-avatars", describe: "`record_avatar`, one per avatar and one per sub-avatar (with `parent`)" },
    { key: "proxy_buying", record: "attribute", required: true, brief: "whether people buy this for someone else", describe: "\"found\" or \"none\" first, then which voices show it or which sources were searched", rule: { kind: "one_of", values: ["found", "none"] } },
  ],
};

export const AWARENESS_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "awareness",
  fields: [{ key: "awareness", record: "awareness", required: true, brief: "for each avatar and channel, how aware they are when they arrive", describe: "`record_awareness`, one per top-level avatar and channel" }],
};
