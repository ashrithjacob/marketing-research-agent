import type { Brief } from "./brief.js";
import type { Deliverable } from "./deliverable.js";
import type { PlanTask } from "./plans.js";
import { CATEGORY_DELIVERABLE, PRODUCT_DELIVERABLE } from "./role-deliverables.js";
import type { TaskContract } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** A task Start may propose: what it is called, what it asks for, what done means, and what it may spend. */
interface SavedTask {
  title: string;
  objective: string;
  complete: Deliverable;
  budget: TaskContract["budget"];
  stopWhen: string;
}

export const SAVED_TASKS: Readonly<Record<string, SavedTask>> = {
  product_facts: {
    title: "Product facts",
    objective: "{subject}: its own fact sheet, read off its own pages",
    complete: PRODUCT_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    stopWhen:
      "The site sells more than one product and the brief does not say which one to research, or the site is not a shop that sells this product.",
  },
  category_numbers: {
    title: "Category numbers",
    objective: "The category {subject} sells in: its search-volume trend, its size and its seasonality, each as a source states it",
    complete: CATEGORY_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    stopWhen: "The product fits more than one category and the sources disagree on which one it is sold in.",
  },
};

/** What Start proposes for a brief, from the saved tasks: the same plan every time, written by no model (spec §11). */
export class SavedPlans {
  static readonly START: readonly string[] = ["product_facts", "category_numbers"];

  static tasks(brief: Brief): PlanTask[] {
    Trace.line(import.meta.url, "SavedPlans.tasks", { brief });
    return SavedPlans.START.map((key) => SavedPlans.task(key, brief));
  }

  static task(key: string, brief: Brief): PlanTask {
    Trace.line(import.meta.url, "SavedPlans.task", { key });
    const saved = SAVED_TASKS[key];
    if (!saved) throw new Error(`no saved task '${key}'; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    const subject = brief.product || brief.url;
    const contract: TaskContract = {
      objective: saved.objective.replace("{subject}", subject),
      primitive: "research",
      complete: saved.complete,
      inputs: { finding_ids: [], document_ids: [] },
      budget: saved.budget,
      verify: "code",
      stop_when: saved.stopWhen,
    };
    return { key, title: saved.title, contract, selected: true, run_id: "", error: "" };
  }
}
