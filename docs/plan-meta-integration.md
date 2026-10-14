# Meta ad results — integration plan

**Status:** plan, 2026-10-14. **Phase D's code and Phase B's reader built
2026-10-14** (always-on part 10, `spec-always-on.md` §7.3 built note): `MetaInsights`,
`research_ad_accounts`, `research_ad_results`, `research_ad_links`, the ad-results
watcher, outcome feedback, and a version's return on ad spend on `/playbooks`. Open
question 1 decided: both, the owner's pasted ad id and the draft's tag in the ad's
name. Not done: Phase A's paperwork, a token, a pilot account, the 500-call history,
App Review, and "Connect Meta"; tokens live in `.env` only (Phase B's design). Meta
has never been called: tested against a stubbed `fetch`. **Parent:** `docs/spec-always-on.md`
(§5.2 ad results as feedback, §7.3 the ad-results watcher, §12 part 10).
**North star:** `docs/goal.md`, "Ads produced by the system beat the owner's
previous ads on their own numbers."

## 1. Why

The learning loop's strongest feedback is how an ad the system wrote actually
performed: spend, cost per purchase, return on ad spend (`spec-always-on.md`
§5.2). That lives in the customer's Meta ad account. This plan is how the app
gets read access to it, starting with one or two pilot clients and ending with
any customer connecting their own account.

What is read, and nothing more: performance. The app never creates, edits or
pauses ads.

## 2. The ways in, and what was decided

Researched 2026-10-14 (sources in §9).

| Route | How it works | Decision |
|---|---|---|
| **Meta's official MCP server** (`mcp.facebook.com/ads`, "Meta Ads AI Connectors") | Launched 29 April 2026, open beta. Meta says it "works with any MCP-compatible AI agent", and a server can call it with a customer's access token. Reporting tools include performance trends, anomaly signals, auction and industry benchmarks. | **Not now.** Meta's token instructions list seven permissions together, including write access (`ads_management`, `catalog_management`); a read-only setup is not documented. No Meta page says whether a platform may hold customers' tokens and call it for them. Pricing after the beta is not announced. Revisit when it is out of beta with a documented read-only option: its benchmark and anomaly tools would be useful to the agents, and pi's MCP client (`pi/packages/mcp`) could call them. |
| **"Connect Meta" button** (Meta's login flow, `ads_read` only) | The customer logs into Meta through the app and approves `ads_read`; the app reads the Insights API. | **The product route.** Read-only, documented, stable. Needs Meta's App Review before it works for strangers (§3), so it comes second. |
| **View access on the pilot client's ad account** | The client gives the Facebook account that is admin on our Meta app view-only access to their ad account; the app reads it with that account's `ads_read` token. | **The pilot route.** Meta's docs say the automatic access level allows app admins and developers to read on behalf of ad accounts they have a role on, so it works before any approval. |
| **Partner sharing** (client shares the ad account with our Business ID) | The agency-standard route; our server would read with a system-user token. | **Fallback for the pilot.** Familiar to clients, but not confirmed to work before App Review: Meta's docs only say an app can reach businesses that have claimed it. |
| **Third-party connector** (Windsor.ai, Unified.to and similar) | They already hold Meta's approval; the customer connects there; the app reads from them. | **Fallback for the product** if App Review stalls. Costs a monthly fee and puts a vendor between the app and the data. |
| **CSV export from Ads Manager** | The owner uploads a file. | **No.** Not always on. Demos only. |

## 3. The approval, and why it sets the order

Every permission a Meta app asks for has two levels (Meta's Marketing API
authorization docs):

| Level | How it is granted | Whose ad accounts it reads |
|---|---|---|
| Standard (tier now named **Limited**) | automatically, when the Marketing API is added to the app | only accounts where someone with a role on our app also has a role on the ad account. "For development only", heavily rate-limited. |
| Advanced (tier now named **Full**) | **App Review** | any customer who approves `ads_read` |

Meta: "If your app is managing other people's ad accounts, you need advanced
access to the `ads_read` … permissions."

App Review asks for:

1. **Usage first:** at least 500 Marketing API calls in the last 15 days, with
   an error rate under 15% over the last 500. Also a condition of keeping the
   access. This is why the reader must run on pilot accounts before applying.
2. A request per permission: App Review → Permissions and Features → "Request
   advanced access" on `ads_read`.
3. A screencast of a user connecting and where the data appears, and a public
   privacy policy.
4. Probably **Business Verification** (company documents). Meta's pages say it
   applies "if your app will access sensitive data" without saying whether
   `ads_read` counts. Start it early regardless.
5. Waiting: no published turnaround; third-party reports range from days to
   months, and a rejection means fixing and resubmitting.

## 4. The plan

### Phase A — paperwork, now (no code)

Runs alongside always-on parts 1–2, because it is the slowest thing in either
plan.

1. Create the Meta developer app at developers.facebook.com, type Business, and
   add the Marketing API (Limited tier, automatic).
2. Start Business Verification for the company in Meta Business Settings.
3. Publish a privacy policy page: what ad data the app reads, why, how long it
   is kept, how a customer disconnects.

**Done when:** the app exists, verification is submitted, the policy URL is live.

### Phase B — the pilot reader (one or two clients)

1. Each pilot client gives our admin Facebook account view-only (performance)
   access to their ad account. Partner sharing if that fails (§2).
2. Log in once through our app, approve `ads_read`, store the token (§5.3).
3. A scheduled job reads Insights for each connected ad account a few times a
   day and stores the rows (§5). The same calls build the 500-call history App
   Review needs.
4. The ad results show on the dashboard for that workspace: spend, CTR,
   purchases, cost per purchase, ROAS per ad.

**Done when:** one pilot account's numbers match Ads Manager for the same ads
and dates (one comparison, quoted), and the call count passes 500 in 15 days
with under 15% errors.

### Phase C — App Review

1. Record the screencast: a client connecting and their numbers appearing.
2. Request advanced `ads_read`.
3. Build the "Connect Meta" button (Meta's login flow, `ads_read` only) while
   waiting; it works for test users before approval.

**Done when:** approved, and a customer outside our team connects with the button.

### Phase D — results as feedback

This is always-on part 10, unchanged in place: the ad-results watcher
(`spec-always-on.md` §7.3) and ad performance as `outcome` feedback against the
draft that produced the ad (§5.2), feeding playbook measurement (§5.5).

**Done when:** a playbook version's numbers include the ROAS of ads written
with it.

## 5. Design

### 5.1 What is read

The Insights API, `GET /v25.0/act_<ad-account-id>/insights`, permission
`ads_read`, at `level=ad`:

- fields: `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `actions`,
  `action_values`, `cost_per_action_type`, `purchase_roas`. Purchases are an
  action type inside `actions`, not a field of their own.
- attribution: the ad set's own settings. Since 10 June 2025 the API follows
  Ads Manager and ignores the old override parameters; the stored row records
  that, so numbers are comparable with what the owner sees.
- timing: Meta refreshes Insights every 15 minutes, and a day's numbers "do not
  change after 28 days". A result is stored as **provisional** until 28 days
  after its date, then **settled**. Feedback (§5.2 of the spec) counts only
  settled rows; the dashboard shows both, labelled.
- large pulls use Meta's asynchronous report jobs; rate limits are read from
  the `x-fb-ads-insights-throttle` header and backed off.

### 5.2 Where it lives in the code

| Layer | Holds |
|---|---|
| `domain` | `AdResult` (ad id, date, the fields above, provisional/settled), and a port `AdResults` with `read(account, dates)` |
| `adapters` | `MetaInsights` implementing `AdResults` over the Graph API; charges nothing (the API is free), so no `research_charges` row |
| `config` | `META_APP_ID`, `META_APP_SECRET` in `settings.ts` |
| store | `research_ad_accounts` (workspace, ad account id, token reference, connected at, status) and `research_ad_results` (one row per ad per day) |
| `agent` | in Phase B a plain scheduled job; in Phase D the ad-results watcher task on pi-durable (§7.3 of the spec) |

### 5.3 Tokens

A Meta access token reads a business's ad data; it is a secret.

- **Phase B:** one token, our own admin account's, which reads every pilot
  account it has a role on. It lives in `.env` as `META_ACCESS_TOKEN`, like the
  other service keys, and never in a tracked file.
- **Phase C on:** one token per customer, so they cannot live in `.env`. Stored
  in `research_ad_accounts`, encrypted with a key from `.env`
  (`MRA_TOKEN_KEY`), decrypted only in the adapter. Disconnecting deletes the
  token.
- Tokens last about 60 days. The adapter refreshes before expiry; a failed
  refresh marks the account `reconnect needed` on the dashboard instead of
  reading empty data silently (a third-party guide reports that a lapsed token
  can return empty results rather than an error).

## 6. Open questions

1. **Which live ad came from which draft?** Outcome feedback needs to know that
   Meta ad `1203…` is the draft the system wrote. Options: the owner pastes the
   ad id onto the draft when launching it, or a naming convention puts the
   draft id in the ad's name and the reader matches it. The second is automatic
   but depends on the owner following it. Undecided; needed by Phase D.
2. **Partner sharing before approval:** whether a system user can read a shared
   ad account at the Limited tier. Test it on the first pilot; it decides
   whether Phase B needs the client to add a person or only to share with the
   business.
3. **Business Verification for `ads_read`:** required or not. Phase A starts it
   anyway.

## 7. Risks

- **App Review stalls or is refused.** Fallback: a third-party connector (§2),
  at a monthly fee.
- **The pilot token is one person's.** If that Facebook account loses its role
  or its login, every pilot read stops. Acceptable for two clients; Phase C
  replaces it.
- **Meta changes the API.** Version v25.0 is pinned in the adapter; Meta
  deprecates versions on a published schedule.

## 8. Cost

The Marketing API is free. The cost is the work in Phases B–D and the time App
Review takes. The official MCP server is free during its beta; its later price
is unknown.

## 9. Sources

Meta (official):

- [Marketing API authorization](https://developers.facebook.com/docs/marketing-api/overview/authorization) — access levels, tiers, the 500-call threshold, OAuth
- [Insights API](https://developers.facebook.com/docs/marketing-api/insights) and [best practices](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices) — fields, 15-minute refresh, 28-day settling, attribution, rate limits
- [System users](https://developers.facebook.com/docs/marketing-api/system-users) and [system user tokens](https://developers.facebook.com/docs/marketing-api/businessmanager/systemuser/install-apps-and-generate-tokens) — token kinds and the 60-day expiring token
- [Ads MCP server, get started](https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-get-started) and [Meta ads AI connectors announcement](https://www.facebook.com/business/news/meta-ads-ai-connectors)

Third party (unconfirmed by Meta where cited):

- [overads: ads_read vs ads_management](https://overads.io/blog/read-only-ad-access)
- [unified.to: Meta Ads API key](https://unified.to/blog/how_to_get_your_meta_ads_api_key)
- [admanage: Meta Ads API limits](https://admanage.ai/blog/meta-ads-api)
- [AdAdvisor: official Meta MCP setup](https://adadvisor.ai/blog/mcp-facebook-com-ads-official-meta-setup)
- [Ampd: partner access in Meta Business Manager](https://servicehub.ampd.io/knowledge/grant-partner-access-in-meta-business-manager)
- [Windsor.ai: Meta Ads API guide](https://windsor.ai/guide-to-facebook-meta-ads-api/)
