import type { Card } from "./cards.js";
import type { Plan } from "./plans.js";

/** One line of the owner's chat with the operator, as the cockpit shows it. */
export interface ChatMessage {
  id: string;
  role: "owner" | "operator";
  text: string;
  partial: boolean;
}

/** One durable task as the board shows it. */
export interface TaskCard {
  run_id: string;
  product_id: string;
  objective: string;
  status: string;
  error: string;
  sources: number;
  attributes: number;
  measurements: number;
  gaps: number;
  calls: number;
  billed_usd: number | null;
  question: string;
  created_at: string;
}

/** What the owner's work looks like right now: the newest plans and the newest tasks. */
export interface Board {
  plans: Plan[];
  tasks: TaskCard[];
  cards: Card[];
  cards_today: number;
}
