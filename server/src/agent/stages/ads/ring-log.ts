import type { AdHit, AdPage } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

export interface RingSearch {
  id: string;
  label: string;
  total: number;
  seen: number;
}

/** What one ring's scout has searched and been shown: each ad under the short ref it cites, the search that first found it, each search's matches against how far it has been paged, and the ads held against the ring's budget. A search claims its page and reserves its ads before it is sent, so searches sent together can neither overrun the budget nor fetch the same page twice. */
export class RingLog {
  private readonly hits = new Map<string, AdHit>();
  private readonly refOf = new Map<string, string>();
  private readonly foundBy = new Map<string, string>();
  private readonly searches = new Map<string, RingSearch>();
  private readonly claimed = new Set<string>();
  private held = 0;

  constructor(private readonly budget: number) {}

  /** Claims one page of one search; false when that page was already sent, so it is not fetched and billed again. */
  claim(signature: string, page: number): boolean {
    Trace.line(import.meta.url, "RingLog.claim", { page });
    const key = `${page}:${signature}`;
    if (this.claimed.has(key)) return false;
    this.claimed.add(key);
    return true;
  }

  /** Gives a claimed page back after its search failed, so it can be asked for again. */
  unclaim(signature: string, page: number): void {
    Trace.line(import.meta.url, "RingLog.unclaim", { page });
    this.claimed.delete(`${page}:${signature}`);
  }

  /** The id an earlier search with these settings was given, if it has come back. */
  idOf(signature: string): string | null {
    Trace.line(import.meta.url, "RingLog.idOf");
    return this.searches.get(signature)?.id ?? null;
  }

  /** Holds up to `asked` ads of the budget for one search and returns how many it got; 0 when the budget is spent. */
  reserve(asked: number): number {
    Trace.line(import.meta.url, "RingLog.reserve", { asked, held: this.held, budget: this.budget });
    const granted = Math.max(0, Math.min(asked, this.budget - this.held));
    this.held += granted;
    return granted;
  }

  /** Gives back reserved ads a search never returned. */
  release(ads: number): void {
    Trace.line(import.meta.url, "RingLog.release", { ads });
    this.held -= ads;
  }

  /** Records a search's page against the `reserved` ads it held; any it did not return go back to the budget. */
  record(signature: string, label: string, offset: number, page: AdPage, reserved: number): { search: RingSearch; refs: string[] } {
    Trace.line(import.meta.url, "RingLog.record", { label, hits: page.hits.length, total: page.total, reserved });
    const search = this.searches.get(signature) ?? { id: `s${this.searches.size + 1}`, label, total: 0, seen: 0 };
    search.total = page.total;
    search.seen = Math.max(search.seen, offset + page.hits.length);
    this.searches.set(signature, search);
    this.release(Math.max(0, reserved - page.hits.length));
    const refs = page.hits.map((hit) => this.add(hit, search));
    return { search, refs };
  }

  hit(ref: string): AdHit | undefined {
    Trace.tick(import.meta.url, "RingLog.hit");
    return this.hits.get(ref);
  }

  found(ref: string): string {
    Trace.tick(import.meta.url, "RingLog.found");
    return this.foundBy.get(ref) ?? "";
  }

  get ads(): number {
    Trace.line(import.meta.url, "RingLog.ads", { ads: this.hits.size });
    return this.hits.size;
  }

  get spent(): boolean {
    Trace.line(import.meta.url, "RingLog.spent", { held: this.held, budget: this.budget });
    return this.held >= this.budget;
  }

  get left(): number {
    Trace.line(import.meta.url, "RingLog.left", { held: this.held });
    return Math.max(0, this.budget - this.held);
  }

  /** Searches that matched more ads than have been paged through. */
  get unfinished(): RingSearch[] {
    Trace.line(import.meta.url, "RingLog.unfinished", { searches: this.searches.size });
    return [...this.searches.values()].filter((search) => search.seen < search.total);
  }

  get searchCount(): number {
    Trace.line(import.meta.url, "RingLog.searchCount", { searches: this.searches.size });
    return this.searches.size;
  }

  private add(hit: AdHit, search: RingSearch): string {
    Trace.tick(import.meta.url, "RingLog.add");
    const known = this.refOf.get(hit.ad_id);
    if (known) return known;
    const ref = `a${this.hits.size + 1}`;
    this.hits.set(ref, hit);
    this.refOf.set(hit.ad_id, ref);
    this.foundBy.set(ref, search.label);
    return ref;
  }
}
