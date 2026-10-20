import type { EvidenceItem, EvidenceKind } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

/** Every piece of evidence the market reader's tools showed it, under the id it cites, and how many paid calls each tool has left. */
export class MarketLog {
  private readonly items = new Map<string, EvidenceItem>();
  private readonly spent = new Map<string, number>();
  private next = 0;

  constructor(private readonly budgets: Readonly<Record<string, number>>) {}

  add(item: Omit<EvidenceItem, "id"> & { id?: string }, prefix: string): EvidenceItem {
    Trace.tick(import.meta.url, "MarketLog.add");
    const id = item.id ?? `${prefix}${++this.next}`;
    const stored = { ...item, id } as EvidenceItem;
    this.items.set(id, stored);
    return stored;
  }

  item(id: string): EvidenceItem | undefined {
    Trace.tick(import.meta.url, "MarketLog.item");
    return this.items.get(id);
  }

  ofKind(kind: EvidenceKind): EvidenceItem[] {
    Trace.line(import.meta.url, "MarketLog.ofKind", { kind });
    return [...this.items.values()].filter((item) => item.kind === kind);
  }

  get all(): ReadonlyMap<string, EvidenceItem> {
    Trace.line(import.meta.url, "MarketLog.all", { items: this.items.size });
    return this.items;
  }

  /** Spends one call of a budgeted tool; false when none is left. */
  spend(tool: string): boolean {
    Trace.line(import.meta.url, "MarketLog.spend", { tool });
    const used = this.spent.get(tool) ?? 0;
    if (used >= (this.budgets[tool] ?? Infinity)) return false;
    this.spent.set(tool, used + 1);
    return true;
  }

  left(tool: string): number {
    Trace.line(import.meta.url, "MarketLog.left", { tool });
    return (this.budgets[tool] ?? Infinity) - (this.spent.get(tool) ?? 0);
  }

  calls(tool: string): number {
    Trace.line(import.meta.url, "MarketLog.calls", { tool });
    return this.spent.get(tool) ?? 0;
  }
}
