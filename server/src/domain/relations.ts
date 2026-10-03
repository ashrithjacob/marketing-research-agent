import type { CompetitorRelation } from "./vocabulary.js";
import { Trace } from "../trace/index.js";

/** Which kind of competitor a product is, read off what it shares with the champion and its form: the agent judges the customer, code decides the kind. */
export class Relations {
  /** No shared active is `indirect_active` in any form; a shared active is `direct` in the champion's form and `indirect_form` in another; two `other` forms cannot be told apart, so that pick is the agent's. */
  static expected(form: string, referenceForm: string, sharedActives: readonly unknown[]): CompetitorRelation | null {
    Trace.line(import.meta.url, "Relations.expected", { form, referenceForm, shared: sharedActives.length });
    if (sharedActives.length === 0) return "indirect_active";
    if (form === "other" && referenceForm === "other") return null;
    return form === referenceForm ? "direct" : "indirect_form";
  }
}
