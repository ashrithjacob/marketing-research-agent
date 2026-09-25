import type { MiningTarget, StagePacket } from "../domain/index.js";

/** Stage 1's packet turned into the listing roster stage 2 mines; pure. */
export class StageTwoRoster {
  static of(packet: StagePacket): MiningTarget[] {
    const reference = packet.competitor_reference;
    if (!reference) return [];
    const product: MiningTarget = {
      id: "product",
      name: reference.name,
      relation: "product",
      form: reference.form,
      actives: [...reference.actives],
      url: "",
    };
    const competitors = packet.competitors.map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      relation: competitor.relation,
      form: competitor.form,
      actives: [...competitor.shared_actives],
      url: competitor.url,
    }));
    return [product, ...competitors];
  }

  static amazonListing(url: string): boolean {
    return /^https?:\/\/(www\.)?amazon\.[a-z.]+\/(.*\/)?(dp|gp\/product)\/[A-Z0-9]{10}/i.test(url);
  }

  static select(targets: readonly MiningTarget[], ids: readonly string[]): MiningTarget[] {
    const wanted = new Set(ids);
    const chosen = targets.filter((target) => wanted.has(target.id));
    return chosen.length > 0 ? chosen : [...targets];
  }
}
