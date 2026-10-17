import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Corpus } from "../../adapters/corpus.js";
import type { FindingKind, Node, Source, StoredRunReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { AgentRoster } from "../agent-roster.js";
import type { DoneCheck } from "../done-check.js";
import { RECORD_TOOLS } from "../prompt/text/record-tools.js";
import { TRUTH_RECORD_TOOLS } from "../prompt/text/truth-record-tools.js";
import type { RunFindings } from "../run-findings.js";

import { FinishTool, type FinishTally } from "./finish-tool.js";
import { ReadLedgerTool, WaitForTool } from "./ledger-read-tools.js";
import { RecordTool, RetractTool } from "./ledger-tools.js";
import { QuoteTool } from "./quote-tool.js";
import { ReadReviewsTool } from "./read-reviews-tool.js";
import { UseSourceTool } from "./use-source-tool.js";

export interface LedgerOptions {
  findings: RunFindings;
  records: readonly FindingKind[];
  check: DoneCheck;
  onChecked: (valid: boolean, problems: readonly string[]) => Promise<void>;
  tally: FinishTally;
  roster?: AgentRoster;
  pollMs?: number;
  /** Sources the earlier stages read, for `use_source`, with the node they are filed under in this run. */
  earlier?: { sources: readonly Source[]; node: Node };
  /** The mined reviews customer truth reads, and the corpus its quotes are copied from: read_reviews and record_quote. */
  voices?: { reviews: readonly StoredRunReview[]; corpus: Corpus };
}

/** An agent's hand on the run ledger: a record tool per kind it may write, retract, read, wait_for when it has agents to wait on, and finish. */
export class LedgerToolset {
  constructor(private readonly options: LedgerOptions) {}

  build(): AgentTool<any>[] {
    Trace.line(import.meta.url, "LedgerToolset.build", { records: this.options.records });
    const ledger = this.options;
    const records = [...RECORD_TOOLS, ...TRUTH_RECORD_TOOLS].filter((spec) => ledger.records.includes(spec.kind)).map((spec) =>
      new RecordTool(spec, ledger.findings).tool(),
    );
    const wait = ledger.roster ? [new WaitForTool(ledger.findings, ledger.roster, ledger.pollMs).tool()] : [];
    const earlier = ledger.earlier ? [new UseSourceTool(ledger.findings, ledger.earlier.sources, ledger.earlier.node).tool()] : [];
    const voices = ledger.voices ? [new ReadReviewsTool(ledger.voices.reviews).tool(), new QuoteTool(ledger.findings, ledger.voices.reviews, ledger.voices.corpus).tool()] : [];
    return [
      ...records,
      ...earlier,
      ...voices,
      new RetractTool(ledger.findings).tool(),
      new ReadLedgerTool(ledger.findings).tool(),
      ...wait,
      new FinishTool(ledger.check, ledger.onChecked, ledger.tally).tool(),
    ];
  }
}
