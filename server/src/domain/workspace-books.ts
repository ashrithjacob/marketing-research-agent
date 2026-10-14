import type { AdBook } from "./ad-results.js";
import type { AlwaysOnBook, ScheduleBook } from "./always-on.js";
import type { CardBook } from "./cards.js";
import type { DraftBook } from "./drafts.js";
import type { FeedbackBook } from "./feedback.js";
import type { LessonBook } from "./lessons.js";
import type { MemoryBook } from "./memory.js";
import type { PlanBook } from "./plans.js";
import type { PlaybookBook } from "./playbooks.js";
import type { WatchBook } from "./watching.js";

/** The always-on side of the store: what a workspace's owner and its operator work with, beside the research runs. */
export interface WorkspaceBooks {
  readonly plans: PlanBook;
  readonly cards: CardBook;
  readonly feedback: FeedbackBook;
  readonly memory: MemoryBook;
  readonly lessons: LessonBook;
  readonly alwaysOn: AlwaysOnBook;
  readonly schedules: ScheduleBook;
  readonly drafts: DraftBook;
  readonly playbooks: PlaybookBook;
  readonly ads: AdBook;
  readonly watch: WatchBook;
}
