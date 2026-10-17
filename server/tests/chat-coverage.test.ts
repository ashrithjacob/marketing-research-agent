/**
 * The chat is the interface (spec-always-on §11, decided 2026-10-16): every server route that starts,
 * guides or stops work has an operator tool that does the same, or is listed here as not a process,
 * with why. A new route fails this test until it is one or the other.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..", "src");

/** Work the chat can start, guide or stop: the route, and the operator tool that does it. */
const FROM_CHAT: Readonly<Record<string, string>> = {
  "POST /runs": "propose_stage",
  "POST /runs/:runId/stop": "stop_research",
  "POST /runs/:runId/steer": "guide_research",
  "POST /runs/:runId/review-analysis": "analyse_reviews",
  "POST /plans": "propose_stage",
  "POST /plans/:planId/approve": "propose_stage",
  "POST /plans/:planId/stages/:stage": "start_customer_voice",
  "POST /plans/:planId/tasks/:key": "revise_plan",
  "POST /tasks": "create_task",
  "POST /tasks/:runId/answer": "answer_task",
  "POST /tasks/:runId/stop": "stop_research",
  "POST /library/:documentId/distil": "make_playbook",
  "POST /schedules": "set_schedule",
};

/** Routes that are not a process the chat runs, each with why. */
const NOT_A_PROCESS: Readonly<Record<string, string>> = {
  "POST /plans/:planId/write": "the long-form statics writer is not built yet (owner, 2026-10-16); it gets its chat tool when it lands",
  "POST /chat": "the chat itself",
  "POST /brands": "opens a brand's chat: the chat's own door",
  "POST /cards/:cardId/answer": "a button: the owner's answer to a card",
  "POST /cards/:cardId/approve": "a button: approvals are buttons, by rule",
  "POST /cards/:cardId/reject": "a button: approvals are buttons, by rule",
  "POST /drafts/:draftId/approve": "drafts are clicked, by rule",
  "POST /drafts/:draftId/reject": "drafts are clicked, by rule",
  "POST /drafts/:draftId/edit": "drafts are clicked, by rule",
  "POST /drafts/:draftId/ads": "links a draft to the ad it became, on the draft's page",
  "POST /memory": "the owner editing what the agent learned by hand; the chat teaches through the reviewer's lessons",
  "POST /memory/:entryId": "the owner editing what the agent learned by hand",
  "DELETE /memory/:entryId": "the owner editing what the agent learned by hand",
  "POST /library": "a file upload, dropped into the memory folder",
  "DELETE /library/:documentId": "removing a file from the memory folder",
  "POST /judgements": "a standing source rule from the old run view; the chat sets rules through lessons",
  "DELETE /judgements/:judgementId": "a standing source rule from the old run view",
  "POST /products/:productId/costs": "the owner typing their own landed unit cost on the Margin card, a figure only they have",
  "POST /runs/:runId/reword": "a backfill: rewrites the gate of a run that ended before runs did it themselves",
  "POST /runs/:runId/sources/:sourceId/wrong": "a correction clicked beside a citation",
  "POST /review-mining/listings": "customer voice's go-ahead from the old run view; start_customer_voice covers it",
  "POST /review-mining/plan": "customer voice's go-ahead from the old run view; start_customer_voice covers it",
  "POST /always-on": "a setting, in the header",
  "DELETE /schedules/:scheduleId": "removing a cadence, a setting",
  "POST /watch/brands": "an Always-on setting",
  "DELETE /watch/brands/:id": "an Always-on setting",
  "POST /ad-accounts": "connecting a Meta ad account, a setting",
  "DELETE /ad-accounts/:id": "disconnecting a Meta ad account, a setting",
  "POST /playbooks/:key/rollback": "playbook version admin",
  "POST /playbooks/:key/restore": "playbook version admin",
  "POST /api/auth/login": "signing in",
  "POST /api/auth/logout": "signing out",
};

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));

const routes = [...new Set(files(join(SRC, "http")).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\.(post|put|patch|delete)\("([^"]+)"/g)].map((m) => `${m[1]!.toUpperCase()} ${m[2]}`)))].sort();
const tools = new Set(files(join(SRC, "agent")).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/defineTool\(\{\s*name: "([a-z_]+)"/g)].map((m) => m[1]!)));

describe("the chat is the interface", () => {
  it("maps every route that changes something to the chat tool that does the same, or to why it is not a process", () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(tools.has("propose_stage")).toBe(true);
    expect(routes.filter((route) => !(route in FROM_CHAT) && !(route in NOT_A_PROCESS))).toEqual([]);
  });

  it("names only operator tools that exist, and only routes that exist", () => {
    expect(Object.values(FROM_CHAT).filter((tool) => !tools.has(tool))).toEqual([]);
    expect([...Object.keys(FROM_CHAT), ...Object.keys(NOT_A_PROCESS)].filter((route) => !routes.includes(route))).toEqual([]);
  });
});
