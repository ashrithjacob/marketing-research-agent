import type { MiningTarget, StagePacket } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Stage 1's packet turned into the listing roster review mining mines; pure. */
export class ReviewMiningRoster {
  static of(packet: StagePacket): MiningTarget[] {
    Trace.line(import.meta.url, "ReviewMiningRoster.of", { packet });
    const reference = packet.competitor_reference;
    if (!reference) return [];
    const product: MiningTarget = {
      id: "product",
      name: reference.name,
      relation: "product",
      form: reference.form,
      actives: [...reference.actives],
      url: packet.brief.url,
      brand: "",
      amazon_url: "",
      trustpilot: "",
      note: "",
    };
    const competitors = packet.competitors.map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      relation: competitor.relation,
      form: competitor.form,
      actives: competitor.active_ingredients.map((active) => active.name_normalised),
      url: competitor.url,
      brand: competitor.brand,
      amazon_url: "",
      trustpilot: "",
      note: "",
    }));
    return [product, ...competitors];
  }

  static select(targets: readonly MiningTarget[], ids: readonly string[]): MiningTarget[] {
    Trace.line(import.meta.url, "ReviewMiningRoster.select", { targets, ids });
    const wanted = new Set(ids);
    const chosen = targets.filter((target) => wanted.has(target.id));
    return chosen.length > 0 ? chosen : [...targets];
  }
}
