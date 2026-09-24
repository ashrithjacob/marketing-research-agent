import { Briefs, type StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";

/** The champion must be the genre's most-bought listing, with the ranking that proves it. */
export class ChampionCheck implements PacketCheck {
  private static RANKING_GAP = /champion ranking unavailable/i;

  problems(packet: StagePacket, { brief }: PacketContext): string[] {
    const reference = packet.competitor_reference;
    if (!reference || !ChampionCheck.isGenreBrief(brief)) return [];
    if (
      packet.gaps.some(
        (gap) => gap.node === "competitors" && ChampionCheck.RANKING_GAP.test(gap.missing),
      )
    ) {
      return [];
    }
    const problems: string[] = [];
    if (reference.reviews_count <= 0) {
      problems.push(
        `champion product '${reference.name}' carries no popularity evidence — rank ` +
          "the genre with `amazon_find_product`, pick the listing with the highest " +
          "`reviewsCount`, and record it in `reviews_count` with the runner-up " +
          'listing\'s name and count; if the ranking cannot be had, gap it as ' +
          '"champion ranking unavailable: <why>"',
      );
      return problems;
    }
    if (!reference.runner_up_name.trim()) {
      problems.push(
        `champion product '${reference.name}' names no runner-up — a ranking of one ` +
          "listing is not a ranking: record the second most-reviewed listing's name " +
          'and count, or gap it as "champion ranking unavailable: <why>"',
      );
    }
    if (reference.runner_up_reviews > reference.reviews_count) {
      problems.push(
        `the runner-up '${reference.runner_up_name}' records ${reference.runner_up_reviews} ` +
          `reviews against the champion's ${reference.reviews_count} — '${reference.name}' ` +
          "is not the most-bought listing in its genre; champion the listing with the " +
          "highest reviewsCount",
      );
    }
    return problems;
  }

  /** A url brief pins the champion to the operator's own site; only a name leaves it open. */
  private static isGenreBrief(brief: PacketContext["brief"]): boolean {
    const url = typeof brief?.url === "string" ? brief.url.trim() : "";
    const product = typeof brief?.product === "string" ? brief.product.trim() : "";
    return url === "" && product !== "" && !Briefs.looksLikeUrl(product);
  }
}
