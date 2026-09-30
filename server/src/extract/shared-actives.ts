import { Trace } from "../trace/index.js";

import { Names } from "./names.js";

/** A competitor's shared actives are picks from the champion's list, compared as written there: the agent that read the page judges the match, code checks it is a pick. */
export class SharedActives {
  static problems(label: string, shared: readonly string[], championActives: readonly string[]): string[] {
    Trace.line(import.meta.url, "SharedActives.problems", { label, shared, championActives });
    const listed = new Set(championActives.map(Names.normalise));
    return shared
      .filter((active) => !listed.has(Names.normalise(active)))
      .map(
        (active) =>
          `${label} lists '${active}' as shared, but shared_actives must be copied word for word from the ` +
          `champion's actives: ${championActives.join(", ")}. If this product has none of them it is neither ` +
          'direct nor indirect — gap it as "same problem, different active"',
      );
  }
}
