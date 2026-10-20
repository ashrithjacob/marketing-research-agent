import type { ActorRunner, ForumPost, ForumQuery, ForumSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ActorResult } from "./actor-result.js";

/** Reddit posts and their comments through `coding-doctor-omar/reddit-scraper-pro`, which has no fee: only Apify's platform time, so it is bounded by a timeout and memory, and its comment defaults (50,000 a post, 10 deep) are capped. Collects pages without Reddit's API; the user accepted that risk on 2026-10-20. */
export class ApifyRedditSearch implements ForumSearch {
  static readonly ACTOR = "coding-doctor-omar/reddit-scraper-pro";
  static readonly LIMITS = { maxTotalChargeUsd: null, timeoutSeconds: 300, memoryMb: 1024 };
  static readonly COMMENT_DEPTH = 2;

  constructor(private readonly runner: ActorRunner) {}

  async search(query: ForumQuery, signal?: AbortSignal): Promise<ForumPost[]> {
    Trace.line(import.meta.url, "ApifyRedditSearch.search", { keywords: query.keywords, subreddits: query.subreddits });
    const input = {
      scrapingMode: query.subreddits.length > 0 ? "standard" : "keywordSearch",
      ...(query.subreddits.length > 0 ? { subredditUrls: query.subreddits.map((name) => `https://www.reddit.com/r/${name.replace(/^r\//, "")}/`) } : {}),
      keywordsIncluded: [...query.keywords],
      maxResults: query.maxPosts,
      maxPostsPerCollection: query.maxPosts,
      timeFrame: "all-time",
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
