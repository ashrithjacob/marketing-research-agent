import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { ForumSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { redditParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** Reddit posts and their top comments for a search or a community: what people tried, doubt and ask. Through Apify; limited. */
export class RedditTool {
  static readonly NAME = "search_reddit";
  static readonly MAX_POSTS = 25;
  static readonly COMMENTS_PER_POST = 15;

  constructor(
    private readonly forum: ForumSearch,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof redditParameters> {
    Trace.line(import.meta.url, "RedditTool.tool");
    const self = this;
    return {
      name: RedditTool.NAME,
      label: "Search Reddit",
      description: `Up to ${RedditTool.MAX_POSTS} Reddit posts and comments from across Reddit for 1 to 3 keyword searches, each post with up to ${RedditTool.COMMENTS_PER_POST} comments. Limited calls.`,
      parameters: redditParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "RedditTool.tool.execute", { keywords: params.keywords });
        const keywords = params.keywords.slice(0, 3);
        if (keywords.length === 0) return ToolReply.refused("Give at least one keyword.");
        if (!self.log.spend(RedditTool.NAME)) return ToolReply.refused("Your Reddit searches are spent.");
        const posts = await self.forum.search({ keywords, maxPosts: RedditTool.MAX_POSTS, commentsPerPost: RedditTool.COMMENTS_PER_POST }, signal);
        const rows = posts.map((post) => {
          const text = `${post.title ? `${post.title}\n` : ""}${post.body}`.trim();
          const item = self.log.add({ kind: "reddit", text, url: post.url || null, brand: post.subreddit || null, date: post.posted_at, days_running: null, active: null, volume: null }, "rd-");
          return `[${item.id}] ${post.kind} in ${post.subreddit}${post.score !== null ? `, ${post.score} points` : ""}: "${ToolReply.clip(text, 280)}"`;
        });
        return ToolReply.external([`${posts.length} posts and comments. ${self.log.left(RedditTool.NAME)} Reddit searches left.`, ...rows], { posts: posts.length });
      },
    };
  }
}
