import type { ActorRunner, ForumPost, ForumQuery, ForumSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ActorResult } from "./actor-result.js";

/** Reddit posts and their comments, site-wide by keyword, through `coding-doctor-omar/reddit-scraper-pro` (input as of build 0.0.48, 2026-10-21: one `query` expression). It has no fee, only Apify's platform time, so it is bounded by a timeout and memory, and its comment defaults (50,000 a post, 10 deep) are capped. Collects pages without Reddit's API; the user accepted that risk on 2026-10-20. */
export class ApifyRedditSearch implements ForumSearch {
  static readonly ACTOR = "coding-doctor-omar/reddit-scraper-pro";
  static readonly LIMITS = { maxTotalChargeUsd: null, timeoutSeconds: 300, memoryMb: 1024 };
  static readonly COMMENT_DEPTH = 2;

  constructor(private readonly runner: ActorRunner) {}

  /** Each search in parentheses, joined by OR: the actor's advanced expression syntax. */
  static expression(keywords: readonly string[]): string {
    Trace.line(import.meta.url, "ApifyRedditSearch.expression", { keywords: keywords.length });
    return keywords.map((keyword) => keyword.replace(/[()]/g, " ").trim()).filter((keyword) => keyword !== "").map((keyword) => (keywords.length > 1 ? `(${keyword})` : keyword)).join(" OR ");
  }

  async search(query: ForumQuery, signal?: AbortSignal): Promise<ForumPost[]> {
    Trace.line(import.meta.url, "ApifyRedditSearch.search", { keywords: query.keywords });
    const input = {
      scrapingMode: "keywordSearch",
      query: ApifyRedditSearch.expression(query.keywords),
      maxResults: query.maxPosts,
      sort: "default",
      includeComments: query.commentsPerPost > 0,
      maxCommentsDepth: ApifyRedditSearch.COMMENT_DEPTH,
      maxCommentsPerPost: query.commentsPerPost,
      maxTopCommentsPerPost: query.commentsPerPost,
    };
    const run = await this.runner.run(ApifyRedditSearch.ACTOR, input, ApifyRedditSearch.LIMITS, signal);
    return ActorResult.items(run, ApifyRedditSearch.ACTOR)
      .filter((row) => typeof row.submissionId === "string" && (typeof row.bodyText === "string" || typeof row.title === "string"))
      .map((row) => ({
        id: String(row.submissionId),
        kind: row.submissionType === "comment" ? "comment" : "post",
        url: String(row.submissionUrl ?? ""),
        subreddit: String(row.subreddit ?? ""),
        title: typeof row.title === "string" ? row.title : null,
        body: typeof row.bodyText === "string" ? row.bodyText : "",
        score: ActorResult.number(row.score),
        posted_at: typeof row.submittedAt === "string" ? row.submittedAt.slice(0, 10) : null,
      }));
  }
}
