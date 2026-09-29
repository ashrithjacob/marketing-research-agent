import { TrustpilotProfiles } from "../adapters/index.js";
import {
  AmazonListingLookup,
  MeteredActorRunner,
  type ActorCharge,
  type ActorRunner,
} from "../adapters/apify/index.js";
import type { PageFetcher, StagePacket, TargetListing, TargetListings } from "../domain/index.js";
import { StageTwoRoster } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { StageTwoListings } from "./stage-two-listings.js";

/** When a stage-1 run completes: the Amazon listing of its champion and every competitor, looked up and matched, its Apify spend charged to that run, and the Trustpilot score of each target that will be mined there. */
export class StageOneListings {
  constructor(
    private readonly listings: TargetListings,
    private readonly actors: ActorRunner | null,
    private readonly pages: PageFetcher,
    private readonly concurrency: number,
  ) {}

  get available(): boolean {
    Trace.line(import.meta.url, "StageOneListings.available");
    return this.actors !== null;
  }

  async lookUp(runId: string, packet: StagePacket, onCharge: (charge: ActorCharge) => void): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "StageOneListings.lookUp", { runId });
    if (!this.actors) return [];
    const source = new AmazonListingLookup(new MeteredActorRunner(this.actors, onCharge));
    return new StageTwoListings(this.listings, source, this.concurrency, new TrustpilotProfiles(this.pages)).ensure(runId, StageTwoRoster.of(packet));
  }
}
