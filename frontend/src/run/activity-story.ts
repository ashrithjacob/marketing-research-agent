import type { RunEvent } from '../api';

export type Tone = 'milestone' | 'search' | 'read' | 'insight' | 'problem';
export type StoryLine = { id: number; at: string; tone: Tone; text: string };

type Payload = Record<string, unknown>;

const AGENT_WORK: Record<string, (suffix: string) => string> = {
  resolver: () => 'Identifying your product and shortlisting the competitors a buyer would compare it with',
  product_brief: () => 'Reading your product page to record its ingredients, claims and price',
  competitor: (domain) => `Studying the competitor ${domain}: its product, price and positioning`,
  amazon_listing: () => 'Looking for the Amazon listing, to pull in more customer reviews',
  ad_keywords: () => 'Working out the search terms buyers use, to find the competitor ads that target them',
  ad_reader: (n) => `Reading competitor ads, batch ${n}: who each targets, what it promises, and whether it is winning`,
  ad_placer: (n) => `Matching competitor ads to the buyer groups they speak to, batch ${n}`,
  avatar_reader: (n) => `Reading customer reviews, batch ${n}, and sorting the buyers into groups by their pains and desires`,
  avatar_judge: () => 'Reviewing the buyer groups: merging overlaps and checking each is backed by real reviews',
  market_reader: () => 'Assessing the market: how aware buyers are of the problem, and how crowded the claims are',
};

const SINGLE_AGENTS = new Set(['resolver', 'product_brief', 'competitor', 'ad_keywords', 'avatar_judge', 'market_reader']);

const CHANNELS: Record<string, string> = {
  meta_ads: 'Meta ads',
  google_search: 'Google search',
  amazon_search: 'Amazon search',
  reviews: 'customer reviews',
  landing_pages: 'landing pages',
  amazon_listings: 'Amazon listings',
};

export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function domainOf(url: unknown): string {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '');
  } catch {
    return String(url);
  }
}

function pageOf(url: unknown): string {
  try {
    const parsed = new URL(String(url));
    const path = decodeURIComponent(parsed.pathname).replace(/\/$/, '');
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return String(url);
  }
}

function list(values: unknown): string {
  return ((values as string[] | undefined) ?? []).map((v) => `“${v}”`).join(', ');
}

function agentParts(agentId: unknown): [string, string] {
  const [kind, ...rest] = String(agentId).split(':');
  return [kind, rest.join(':')];
}

function tool(p: Payload): string {
  const args = (p.args ?? {}) as Payload;
  switch (p.tool) {
    case 'web_search': return `Searching the web for “${args.query}”`;
    case 'web_fetch': return `Reading the page ${pageOf(args.url)}`;
    case 'ad_search': return `Searching the ad library for brands advertising “${args.query}”`;
    case 'search_ad_history': return `Checking how long ${args.domain} has kept its ads running, a sign of which ones make money`;
    case 'page_history': return `Checking how ${domainOf(args.url)}'s page has changed over time`;
    case 'read_snapshot': return 'Reading an archived version of a competitor page';
    case 'search_suggestions': return `Checking what people search on ${humanize(String(args.source ?? 'Google'))} around “${args.seed}”`;
    case 'search_amazon': return `Checking which products Amazon shows for ${list(args.keywords)}`;
    case 'search_reddit': return `Reading Reddit conversations about ${list(args.keywords)}`;
    case 'find_reviews': return `Finding customer reviews that say “${args.phrase}”`;
    case 'read_landing': return 'Reading the landing page behind a competitor ad';
    case 'list_ads': return 'Going through the competitor ads collected so far';
    case 'search_volume': return `Measuring monthly search volume for ${((args.query_ids as unknown[]) ?? []).length} searches`;
    case 'assign': return `Recording what the “${humanize(String(args.key))}” buyers feel and want`;
    case 'revise': return `Refining the “${humanize(String(args.key))}” buyer group with new evidence`;
    default: return humanize(String(p.tool));
  }
}

function agentStarted(p: Payload): string {
  const [kind, suffix] = agentParts(p.agent_id);
  return AGENT_WORK[kind]?.(suffix) ?? `${humanize(kind)} started`;
}

function agentEnded(p: Payload): [Tone, string] | null {
  const [kind, suffix] = agentParts(p.agent_id);
  const work = AGENT_WORK[kind]?.(suffix) ?? humanize(kind);
  const step = work.charAt(0).toLowerCase() + work.slice(1);
  if (p.status === 'completed') return SINGLE_AGENTS.has(kind) ? ['milestone', `Done: ${step}`] : null;
  if (p.status === 'cancelled') return ['problem', `Stopped before finishing: ${step}`];
  if (p.status === 'invalid') return ['problem', `Result set aside because it did not pass the evidence checks: ${step}`];
  return ['problem', `Could not finish: ${step}`];
}

function stageChanged(p: Payload, titles: Record<string, string>): [Tone, string] | null {
  const title = titles[String(p.stage)] ?? humanize(String(p.stage));
  const summary = p.summary ? ` ${String(p.summary)}` : '';
  switch (p.status) {
    case 'running': return ['milestone', `Started: ${title}`];
    case 'completed': return ['milestone', `Completed: ${title}.${summary}`];
    case 'skipped': return ['problem', `Skipped: ${title}, because a step it depends on did not finish`];
    case 'cancelled': return ['problem', `Stopped: ${title}`];
    case 'failed': return ['problem', `${title} ran into a problem and stopped`];
    case 'invalid': return ['problem', `${title} finished, but its result did not pass the evidence checks`];
    default: return null;
  }
}

function runEnded(p: Payload): [Tone, string] {
  if (p.status === 'completed') return ['milestone', 'Research complete'];
  if (p.status === 'cancelled') return ['problem', 'Research stopped'];
  if (p.status === 'invalid') return ['problem', 'Research finished, but part of the result did not pass the evidence checks'];
  return ['problem', 'Research stopped because of an error. The step that failed is marked above; you can rerun it'];
}

function line(event: RunEvent, titles: Record<string, string>): [Tone, string] | null {
  const p = event.payload;
  switch (event.kind) {
    case 'tool.called': return [p.tool === 'web_fetch' || p.tool === 'read_snapshot' || p.tool === 'read_landing' ? 'read' : 'search', tool(p)];
    case 'agent.started': return ['read', agentStarted(p)];
    case 'agent.ended': return agentEnded(p);
    case 'agent.resumed': return ['problem', 'The AI model dropped the connection; switched to a backup model and carried on'];
    case 'agent.model_switched': return ['problem', `An agent kept sending the same calls; moved it from ${String(p.from)} to ${String(p.to)}`];
    case 'stage.changed': return stageChanged(p, titles);
    case 'reviews.collected': return ['insight', `Collected ${p.collected} customer reviews for ${p.target} (${p.saved} new)`];
    case 'avatars.memory': return ['insight', `Buyer groups so far, after review batch ${p.batch}: ${(p.avatars as { key: string; reviews: number }[]).map((a) => `${humanize(a.key)} (${a.reviews} reviews)`).join(', ')}`];
    case 'traction.collected': return ['insight', `Estimated monthly sales for ${p.found} of ${p.of} stores`];
    case 'market.read': return ['insight', `Market read: sophistication stage ${p.stage} of 5, measured across ${((p.channels as string[]) ?? []).map((c) => CHANNELS[c] ?? humanize(c)).join(', ')}`];
    case 'run.resolved': return ['milestone', `Found your product and proposed ${p.competitors} competitors. Waiting for you to confirm them`];
    case 'run.rerun': return ['milestone', `Running again: ${((p.stages as string[]) ?? []).map((s) => titles[s] ?? humanize(s)).join(', ')}`];
    case 'run.ended': return runEnded(p);
    default: return null;
  }
}

export function story(events: RunEvent[], titles: Record<string, string>): StoryLine[] {
  return events.flatMap((event) => {
    const told = line(event, titles);
    return told ? [{ id: event.id, at: event.created_at, tone: told[0], text: told[1] }] : [];
  });
}
