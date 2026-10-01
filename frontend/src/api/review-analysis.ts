/** A review-mining run's review analysis. Mirrors the server's `/runs/:id/review-analysis`. */

export type IssueKind = 'complaint' | 'request' | 'praise';

export interface Issue {
  id: string;
  label: string;
  kind: IssueKind;
  description: string;
}

export interface IssueQuote {
  ref: string;
  star: number | null;
  title: string;
  text: string;
  platform: 'amazon' | 'trustpilot';
  locator: string;
}

export type SourceScope = 'all' | 'amazon' | 'other';
export type GroupScope = 'product' | 'direct' | 'indirect';

export const SOURCE_LABEL: Record<SourceScope, string> = { all: 'All sources', amazon: 'Amazon', other: 'Other sites' };
export const GROUP_LABEL: Record<GroupScope, string> = {
  product: 'Main product',
  direct: 'Direct competitors',
  indirect: 'Indirect competitors',
};

export interface ProductIssue {
  issue_id: string;
  mentions: number;
  share: number;
  score: number;
  quotes: string[];
}

export interface ProductVoice {
  source: SourceScope;
  target_id: string;
  name: string;
  relation: string;
  reviews: number;
  stars: [number, number, number, number, number];
  complaints: number;
  issues: ProductIssue[];
}

export interface RankedIssue {
  issue_id: string;
  mentions: number;
  score: number;
  quotes: string[];
}

export interface IssueSlice {
  source: SourceScope;
  group: GroupScope;
  reviews: number;
  ranked: RankedIssue[];
}

export interface CleaningTally {
  fetched: number;
  duplicates: number;
  empty: number;
  off_product: number;
  untagged: number;
  kept: number;
}

export interface ReviewAnalysis {
  run_id: string;
  status: 'running' | 'done' | 'failed';
  error: string;
  started_at: string;
  ended_at: string;
  model: string;
  llm_calls: number;
  cost_usd: number;
  star_weights: Record<'1' | '2' | '3' | '4' | '5', number>;
  cleaning: CleaningTally;
  issues: Issue[];
  slices: IssueSlice[];
  products: ProductVoice[];
  quotes: Record<string, IssueQuote>;
}

export interface ReviewAnalysisResponse {
  analysis: ReviewAnalysis | null;
}

export const GRID_COLUMNS = 6;

export function issueIndex(analysis: ReviewAnalysis): Map<string, Issue> {
  return new Map(analysis.issues.map((issue) => [issue.id, issue]));
}

export function sliceOf(analysis: ReviewAnalysis, source: SourceScope, group: GroupScope): IssueSlice | undefined {
  return analysis.slices.find((slice) => slice.source === source && slice.group === group);
}

export function productsIn(analysis: ReviewAnalysis, source: SourceScope, group: GroupScope): ProductVoice[] {
  return analysis.products.filter((p) => p.source === source && p.relation === group);
}

export function quotesFor(analysis: ReviewAnalysis, refs: string[]): IssueQuote[] {
  return refs.flatMap((ref) => (analysis.quotes[ref] ? [analysis.quotes[ref]] : []));
}

/** The complaints and requests that head a ranking — the grid's columns. */
export function gridColumns(analysis: ReviewAnalysis, ranked: RankedIssue[], limit = GRID_COLUMNS): Issue[] {
  const index = issueIndex(analysis);
  return ranked
    .map((r) => index.get(r.issue_id))
    .filter((issue): issue is Issue => !!issue && issue.kind !== 'praise')
    .slice(0, limit);
}

export function productIssue(product: ProductVoice, issueId: string): ProductIssue | undefined {
  return product.issues.find((issue) => issue.issue_id === issueId);
}

/** A product's issues of one side, best-scored first: worst things (complaints, requests) or best things (praise). */
export function productSide(
  analysis: ReviewAnalysis,
  product: ProductVoice,
  side: 'worst' | 'best',
  limit = 5,
): ProductIssue[] {
  const index = issueIndex(analysis);
  return product.issues
    .filter((issue) => (index.get(issue.issue_id)?.kind === 'praise') === (side === 'best'))
    .slice(0, limit);
}
