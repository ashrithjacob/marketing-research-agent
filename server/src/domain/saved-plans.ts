import type { Brief } from "./brief.js";
import type { Deliverable } from "./deliverable.js";
import { Contracts } from "./contracts.js";
import type { PlanStage, PlanTask } from "./plans.js";
import { CATEGORY_DELIVERABLE, CHAMPION_DELIVERABLE, COMPETITORS_DELIVERABLE, PRODUCT_DELIVERABLE } from "./role-deliverables.js";
import { StageOnePlans, type StageOneAgent } from "./stage-one-agents.js";
import type { TaskContract } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** A task Start may propose: what it is called, the stage-1 role it works as, what it asks for, what done means, what it may spend, when it stops to ask, and, for one that may spend Apify money, how its approval is put to the owner in plain words. */
interface SavedTask {
  title: string;
  approval?: { title: string; why: string };
  method: StageOneAgent;
  objective: string;
  complete: Deliverable;
  budget: TaskContract["budget"];
  stopWhen: string;
}

export const SAVED_TASKS: Readonly<Record<string, SavedTask>> = {
  champion: {
    title: "Champion product",
    approval: { title: "Search Amazon for the category's best-seller?", why: "To compare {name} with the product that leads its category, the agent looks it up on Amazon, which is a paid search." },
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
    approval: { title: "Look up {name}'s competitors on Amazon?", why: "To see who else sells to {name}'s customers, and how they price and rate, the agent looks each competitor up on Amazon, which is a paid search." },
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

  /** The tasks Start proposes; given `keep`, only those keys are selected, and the champion follows from them. */
  static tasks(brief: Brief, keep: readonly string[] = []): PlanTask[] {
    Trace.line(import.meta.url, "SavedPlans.tasks", { brief, keep });
    const tasks = SavedPlans.START.map((key) => SavedPlans.task(key, brief));
    return SavedPlans.arrange(brief, keep.length === 0 ? tasks : tasks.map((task) => (task.auto ? task : { ...task, selected: keep.includes(task.key) })));
  }

  /** The tasks an owner may name: every saved stage-1 task but the champion, which the plan keeps by itself. */
  static parts(): string[] {
    Trace.line(import.meta.url, "SavedPlans.parts");
    return SavedPlans.START.filter((key) => key !== "champion");
  }

  /** The later stages a plan may run after stage 1, each off until the owner ticks it. */
  static stages(): PlanStage[] {
    Trace.line(import.meta.url, "SavedPlans.stages");
    return [
      { stage: 2, title: "Product truth", selected: false, run_id: "", error: "" },
      { stage: 3, title: "Review mining", selected: false, run_id: "", error: "" },
    ];
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
    const nodes = tasks.filter((task) => !task.auto && task.selected).flatMap((task) => Contracts.node(task.contract) ?? []);
    const champion = nodes.length > 0 && StageOnePlans.of(brief, nodes).champion;
    return tasks.map((task) => (task.auto ? { ...task, selected: champion } : { ...task, after: champion && task.selected ? ["champion"] : [] }));
  }
}
