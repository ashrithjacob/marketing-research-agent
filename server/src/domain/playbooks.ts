import type { Scope } from "./accounts.js";
import type { PrimitiveName } from "./task-contract.js";

/** One section a draft must have, and what it must do. */
export interface PlaybookSection {
  key: string;
  title: string;
  describe: string;
}

/** How to do a class of task (spec §5.1): what it is for, the owner's document it comes from, the sections a draft has, and what a critic checks. */
export interface PlaybookBody {
  key: string;
  title: string;
  primitive: PrimitiveName;
  document_title: string;
  read_first: string[];
  sections: PlaybookSection[];
  criteria: string[];
}

export type PlaybookStatus = "active" | "stale" | "archived";

/** One version of a workspace's playbook (spec §5.4–5.6): nothing is overwritten, a change is a new version, and the newest is the one tasks read. Status is the curator's mark on the playbook, kept on its newest version. */
export interface Playbook extends PlaybookBody {
  workspace_id: string;
  version: number;
  by: "seed" | "lesson" | "owner" | "rollback";
  lesson_id: string;
  status: PlaybookStatus;
  created_at: string;
}

export interface PlaybookBook {
  current(scope: Scope, key: string): Promise<Playbook | null>;
  at(scope: Scope, key: string, version: number): Promise<Playbook | null>;
  /** The newest version of every playbook of a workspace. */
  list(workspaceId: string): Promise<Playbook[]>;
  history(workspaceId: string, key: string): Promise<Playbook[]>;
  add(workspaceId: string, body: PlaybookBody, by: Playbook["by"], lessonId: string): Promise<Playbook>;
  mark(workspaceId: string, key: string, status: PlaybookStatus): Promise<void>;
}

/** The playbooks every workspace starts with, as version 1 by `seed`. The long-form static is from the owner's Long-Form Statics Playbook (uploaded to the library 2026-10-12): its Section 05, "The Complete Script Structure", names the five parts. */
export const SEED_PLAYBOOKS: Readonly<Record<string, PlaybookBody>> = {
  long_form_static: {
    key: "long_form_static",
    title: "Long-form static ad",
    primitive: "write",
    document_title: "Long Form Statics Playbook",
    read_first: ["Section 05", "Section 06", "Section 07", "Section 08", "Section 09", "Section 10", "Section 12"],
    sections: [
      { key: "hook", title: "Hook / Headline", describe: "the first one or two lines before 'See more': emotional, with jeopardy; stops the scroll and filters the audience" },
      { key: "lead", title: "Lead", describe: "the storyline before the mechanism: identification, symptoms, the fear, the solutions that failed, the real-life cost, the core emotion" },
      { key: "mechanism", title: "Mechanism", describe: "why the problem exists, reframed, and why this product works differently; it must be novel" },
      { key: "product_intro", title: "Product intro", describe: "the product enters as the story's resolution, a discovery, never announced" },
      { key: "close", title: "Close", describe: "differentiation, a stack of proof, risk reversal, urgency, the call to action; a PS if it helps" },
    ],
    criteria: [
      "The hook stops the scroll and filters for the customer, with emotion and jeopardy, in the first two lines.",
      "The lead makes the customer recognise themselves: symptoms, fear, failed solutions, real cost.",
      "The mechanism is novel: it explains the problem anew and why this product works differently.",
      "The product enters as the resolution of the story, not as an announcement.",
      "The close stacks proof, reverses risk and ends with one clear call to action.",
      "Every claim about the product, the customer or the market cites a finding, and no figure is made up.",
    ],
  },
};
