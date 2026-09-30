but in the stage 1 where is the need for this, in product data and category data its just field filling. In competitors perhaps. I think we need three agents for each of these three tasks with their own user prompts.

here is how we will redesign this stage 1, lets make it a little more well defined and less open ended.

make the code as simple as possible with as few moving parts:
here are the stages:
-USER CLICKS START RUN:
STEP1:
MAIN AGENT:(has the same systme prompt, but user prompt is specific to finding the champion)
find champion name:
- if url, THEN find you already found chanpion urlrand. just find the amazon page for it (how to do: use Apify actor to resolve URL to its corresponding Amazon product page) if not found, then leave as is
- if product name given, then run apify to get the amazon product page and find the champion product. use firecrawl or any other tool to search the URL that apify returns for the most reviewed product for that keyword and thats you champion url

STEP 2:
RUn three agents in parallel. each has specific user prompt, again same system prompt as we had before for stage 1.

agent product data: Gets the product data all the fields we currently need. use the architecture we currently have where once a field is filled it's written to ledger and only the remaining fields get searched for, till we fill up the ledger. (Stop condition as we have now, with gaps higligted).

agent competitors: here we can use saturation since its open ended again it's own agent with its own user prompt. same system prompt. 

agent category data: own user prompt, different system prompt. gets all the required fields like the product data agent.

these three can run in parallel and queue the firecrawl in case of rate limits.

all write to same ledger which then writes to DB at the end of the agents respective runs
each agent has an agent_id that persists till the agent_run completes
the competitor research agent needs to get the form factor from the main agent, so we give the agent read ability on each other's ledger (or if its a common ledger then same ledger's read ability. any data written by the agent gets an agent_id tag. agent can only overwrite data from ledger associated with it's agent id. this way in case it finds better info it can overwrite its own data but only read from other's data).

If an agent is blocked on a task because data from another to be retireved is pending, then poll the ledger (every 15s), and once its ready we can continue.


make the architecture really simple and remove any fluff code from stage 1 if present


---

## Decided while building it, 2026-09-30

How the notes above were read, and the questions they left open, answered then.

| # | Question | Decided | Rejected |
|---|---|---|---|
| 1 | Does step 1 run on every run? | Yes, except a **url brief without `competitors`**: the url already names the product, and no competitor needs an Amazon-ranked reference. `mra run "https://…" product_data,category_data` stays the run that spends nothing on Apify. A genre brief runs it even on `product_data` alone: product data needs to know which product to fill in | Always (no free verification run left); only with `competitors` (product data on a genre brief researches the genre name, the old ambiguity) |
| 2 | Polling | `wait_for(agent, kind)` for step-2 agents: reads the ledger every 15 s, returns the rows once there, returns early when that agent has ended or the run stops, gives up after 40 checks (10 min) so two agents waiting on each other both carry on | No wait tool — the champion is finished before step 2 starts, so no *current* dependency needs it; kept because the notes ask for it |
| 3 | UI | One tab per agent on the activity log, plus a `run` tab of milestones | One merged log tagged by agent |
| 4 | Ledger | The existing `research_findings` table in SQLite **is** the common ledger: rows are written as found (so a restart keeps them) and the packet is built from it when the last agent ends. Every row carries `agent_id`; an agent replaces or retracts only its own rows (`RunFindings`), and reads everyone's (`read_ledger`) | A ledger in memory written to the DB at the end — loses the run's findings on a restart, which the table was built to stop |
| 5 | Category's system prompt | Its own (`CATEGORY_SYSTEM_PROMPT`); champion, product and competitors share one. All four list only the tools that agent has | — |
| 6 | Stop condition | Product and **category** are done when their checklist is recorded or gapped; only competitors is done by saturation. `CompletenessCheck` no longer asks a complete `category_data` for a curve | Category by saturation, as before |
| 7 | Where the champion reaches step 2 | Code copies the champion row from the ledger into each step-2 agent's prompt when it starts, so no agent spends a turn reading it | Each agent calls `read_ledger` first |
| 8 | What a `finish` means | It checks **that agent's part** and ends that agent. The run is settled once, when the last agent ends: every agent's check again, then the whole packet. Found by a test: without the per-agent re-check, a category part with no gaps settled `completed`, because product's gaps made the packet's list non-empty | A passing `finish` writing the run's packet (only one agent could) |
| 9 | Where the champion's Amazon page goes | A new `amazon_url` field on `competitor_reference`, `""` when none matches | A source row — `web_fetch` cannot read Amazon, and a source must be a page read |

Firecrawl needed no change for parallel agents: every outside call already goes
through one queue per service, shared across the process (`ServiceQueue`, 2 for
Firecrawl), and a 429 is waited out (`workings.md` Step 5).

### Added 2026-10-01

| # | Question | Decided | Rejected |
|---|---|---|---|
| 10 | What each agent's prompt is | Its own task only — fields, where to look, how to work, when to stop — plus a short shared block on recording sources. Product and category record their fields and nothing else: no excerpts, no fields of their own. Competitors records competitor rows. Measured on run `0dc7e23c`: the generic rules sent product after 61 excerpts (10½ min), and category spent 18 of 50 turns on a trend it could not get | One shared rules text with the task set inside it |
| 11 | How "only the remaining fields" is held | By code: a key outside the agent's list is refused when written, and `finish` names every field neither recorded nor gapped. A re-recorded field replaces the agent's earlier row | Prompt wording alone |
| 12 | Category's fields | `search_volume` (one row per period, three or more years), `category_size: <segment>`, `seasonality` | Free metric names || 13 | Product fields outside the ten | Kept: the agent tries for the ten first and may record other facts as attributes with its own key. Category stays closed to its three | Refusing them (decision 11, reversed the same day: it dropped facts the operator wanted) |
| 14 | How long an agent may try | A turn limit per agent (champion 10, product 15, category 15, competitors 20 — the operator's numbers; first set at category 20, competitors 40), stated in its prompt and enforced by pi-agent-core's `finishTurn`. At the limit, code records every field still open as a gap and the status as incomplete, so the run shows gaps instead of an unfinished part | Unbounded turns (category took 50 on run `0dc7e23c`) |
| 15 | Category fields outside the three | Kept, as for product: the three first, then any other number or fact under a metric or key the agent names. Nothing is refused by key now; `finish` and the turn limit hold the required fields | Category closed to its three (decision 13) |
