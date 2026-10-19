import type { ReadAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

/** How stage 4's ads fall into the rings a growth marketer studies: competitors' own, same problem, same buyer, unrelated. */
export class AdStageSummary {
  static rings(ads: readonly ReadAd[]): string {
    Trace.line(import.meta.url, "AdStageSummary.rings", { ads: ads.length });
    const competitor = ads.filter((ad) => ad.competitor_id !== null).length;
    const others = ads.filter((ad) => ad.competitor_id === null && ad.reading);
    const count = (relation: string) => others.filter((ad) => ad.reading!.relation === relation).length;
    return `${competitor} from competitors, ${count("same_problem")} same problem, ${count("same_buyer")} same buyer, ${count("unrelated")} unrelated`;
  }
}
