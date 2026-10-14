import type { Brief } from "./brief.js";
import type { Deliverable } from "./deliverable.js";
import type { Node } from "./nodes.js";
import type { PlanTask } from "./plans.js";
import { CATEGORY_DELIVERABLE, CHAMPION_DELIVERABLE, COMPETITORS_DELIVERABLE, PRODUCT_DELIVERABLE } from "./role-deliverables.js";
import { StageOnePlans, type StageOneAgent } from "./stage-one-agents.js";
import type { TaskContract } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** A task Start may propose: what it is called, the stage-1 role it works as, what it asks for, what done means, what it may spend, and when it stops to ask. */
interface SavedTask {
  title: string;
  method: StageOneAgent;
  objective: string;
  complete: Deliverable;
  budget: TaskContract["budget"];
  stopWhen: string;
}

export const SAVED_TASKS: Readonly<Record<string, SavedTask>> = {
  champion: {
    title: "Champion product",
    method: "champion",
    objective: "The product every other task measures {subject} against",
    complete: CHAMPION_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    stopWhen: "",
  },
  product_facts: {
    title: "Product facts",
    method: "product",
    objective: "{subject}: its own fact sheet, read off its own pages",
    complete: PRODUCT_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    stopWhen:
      "The site sells more than one product and the brief does not say which one to research, or the site is not a shop that sells this product.",
  },
  competitors: {
    title: "Competitors",
    method: "competitors",
    objective: "Every product sold to {subject}'s customer: direct, indirect by form, and indirect by active",
    complete: COMPETITORS_DELIVERABLE,
    budget: { max_usd: 1, max_minutes: 30 },
    stopWhen: "",
  },
  category_numbers: {
    title: "Category numbers",
    method: "category",
    objective: "The category {subject} sells in: its search-volume trend, its size and its seasonality, each as a source states it",
    complete: CATEGORY_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    stopWhen: "The product fits more than one category and the sources disagree on which one it is sold in.",
  },
};

/** What Start proposes for a brief: stage 1 as a plan, from the saved tasks, the same every time and written by no model (spec §11). The champion is not the owner's to tick: the plan keeps it exactly when stage 1 would run one, and then every other task starts after it. */
export class SavedPlans {
  static readonly START: readonly string[] = ["champion", "product_facts", "competitors", "category_numbers"];

  static tasks(brief: Brief): PlanTask[] {
    Trace.line(import.meta.url, "SavedPlans.tasks", { brief });
    return SavedPlans.arrange(brief, SavedPlans.START.map((key) => SavedPlans.task(key, brief)));
  }

  static task(key: string, brief: Brief): PlanTask {
    Trace.line(import.meta.url, "SavedPlans.task", { key });
    const saved = SAVED_TASKS[key];
    if (!saved) throw new Error(`no saved task '${key}'; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    const contract: TaskContract = {
      objective: saved.objective.replace("{subject}", brief.product || brief.url),
      primitive: "research",
      method: saved.method,
      complete: saved.complete,
      inputs: { finding_ids: [], document_ids: [] },
      budget: saved.budget,
      verify: "code",
      ...(saved.stopWhen ? { stop_when: saved.stopWhen } : {}),
    };
    return { key, title: saved.title, contract, selected: true, auto: key === "champion", after: [], run_id: "", error: "" };
  }

  /** The champion kept or dropped by what the other kept tasks need, and each other task after it while it is kept. */
  static arrange(brief: Brief, tasks: readonly PlanTask[]): PlanTask[] {
    Trace.line(import.meta.url, "SavedPlans.arrange", { tasks: tasks.length });
    const nodes = tasks.filter((task) => !task.auto && task.selected && task.contract.complete.node).map((task) => task.contract.complete.node as Node);
    const champion = nodes.length > 0 && StageOnePlans.of(brief, nodes).champion;
    return tasks.map((task) => (task.auto ? { ...task, selected: champion } : { ...task, after: champion && task.selected ? ["champion"] : [] }));
  }
}
