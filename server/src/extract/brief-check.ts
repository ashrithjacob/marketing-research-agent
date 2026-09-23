import { Briefs, type StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";
import { BrandLabels, Names } from "./names.js";

/** The worked example is not the assignment: the packet must be about this brief. */
export class BriefCheck implements PacketCheck {
  problems(packet: StagePacket, { brief }: PacketContext): string[] {
    const wanted = typeof brief?.product === "string" ? Names.normalise(brief.product) : "";
    const site = typeof brief?.url === "string" ? brief.url.trim() : "";
    const got = Names.normalise(packet.brief.product);

    if (got && Briefs.looksLikeUrl(got)) {
      return [
        `packet brief.product is '${packet.brief.product}', which is a url — it must be ` +
          `the product's name as the site writes it, with the url in brief.url`,
      ];
    }
    if (site && !wanted) return this.siteProblems(packet, site, got);
    if (wanted && got) return this.productProblems(packet, brief, wanted, got);
    return [];
  }

  private siteProblems(packet: StagePacket, site: string, got: string): string[] {
    const matches =
      Names.sameHost(site, packet.brief.url) ||
      (BrandLabels.of(site) ?? []).some((label) =>
        Names.squash(got).includes(Names.squash(label)),
      );
    if (!got || matches) return [];
    return [
      `packet brief is about '${packet.brief.product}', but this run's brief is the ` +
        `site '${site}' — the worked example is not the assignment`,
    ];
  }

  private productProblems(
    packet: StagePacket,
    brief: PacketContext["brief"],
    wanted: string,
    got: string,
  ): string[] {
    const labels = BrandLabels.of(wanted);
    const matches = labels
      ? labels.some((label) => Names.squash(got).includes(Names.squash(label)))
      : got.includes(wanted) || wanted.includes(got);
    if (matches) return [];
    return [
      `packet brief is about '${packet.brief.product}', but this run's brief is ` +
        `'${String(brief?.product)}' — the worked example is not the assignment`,
    ];
  }
}
