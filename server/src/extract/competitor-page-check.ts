import type { Competitor, Source, StagePacket } from "../domain/index.js";
import { BrandWords } from "./brand-words.js";
import type { PacketCheck } from "./check.js";
import { Names } from "./names.js";
import { Trace } from "../trace/index.js";

/** A competitor's evidence is its own product page: not an ad library, and not a page that sells another brand. */
export class CompetitorPageCheck implements PacketCheck {
  problems(packet: StagePacket): string[] {
    Trace.line(import.meta.url, "CompetitorPageCheck.problems", { competitors: packet.competitors.length });
    const sources = new Map(packet.sources.map((source) => [source.id, source]));
    const ingredients = CompetitorPageCheck.ingredientWords(packet);
    const brandsPerPage = new Map<string, Set<string>>();
    for (const row of packet.competitors) {
      const brands = brandsPerPage.get(row.source_id) ?? new Set<string>();
      brands.add(Names.squash(CompetitorPageCheck.brand(row)));
      brandsPerPage.set(row.source_id, brands);
    }
    return packet.competitors.flatMap((row) => {
      const source = sources.get(row.source_id);
      if (!source) return [];
      const shared = (brandsPerPage.get(row.source_id)?.size ?? 0) > 1;
      const problem = CompetitorPageCheck.problem(row, source, shared, BrandWords.of(CompetitorPageCheck.brand(row), ingredients));
      return problem ? [problem] : [];
    });
  }

  private static problem(row: Competitor, source: Source, shared: boolean, brand: BrandWords): string | null {
    Trace.line(import.meta.url, "CompetitorPageCheck.problem", { competitor: row.id, source: source.id, shared });
    const label = `competitor '${CompetitorPageCheck.brand(row)}' (${row.id})`;
    const fix = "read the brand's own product page and cite that, or drop the brand and add a gap naming where you saw it";
    if (source.kind === "ad_library") {
      return `${label} cites an ad-library page as its product page — ads go in ad_source_ids; ${fix}`;
    }
    if (brand.words.length === 0) return null;
    const inTitle = brand.namedInTitle(source.title);
    if (shared && !inTitle) {
      return `${label} cites '${source.title || source.url}', a page other competitors also cite and whose title does not name this brand — it is another brand's product; ${fix}`;
    }
    if (!shared && !inTitle && !brand.namedInAddress(row.url) && !brand.namedInAddress(source.url)) {
      return `${label} cites '${source.title || source.url}', which names this brand in neither its title nor its web address; ${fix}`;
    }
    return null;
  }

  private static brand(row: Competitor): string {
    Trace.tick(import.meta.url, "CompetitorPageCheck.brand", {});
    return row.brand.trim() || row.name;
  }

  private static ingredientWords(packet: StagePacket): Set<string> {
    Trace.line(import.meta.url, "CompetitorPageCheck.ingredientWords");
    const names = [
      ...(packet.competitor_reference?.actives ?? []),
      ...packet.competitors.flatMap((row) => row.shared_actives),
    ];
    return new Set(names.flatMap((name) => BrandWords.split(name)));
  }
}
