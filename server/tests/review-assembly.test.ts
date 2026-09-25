/**
 * The review half of a packet is built from the ledger, not written by the model.
 *
 * So an excerpt's text is the fetched text byte for byte, its source is the hash
 * the corpus holds, and every fetched review reaches the packet, stored raw.
 */

import { describe, expect, it } from "vitest";

import type { ReviewLedgerSnapshot } from "../src/domain/index.js";
import { PacketValidator, ReviewAssembly } from "../src/extract/index.js";
import { reviewPacket } from "./fixtures.js";

const HASH = `sha256:${"b".repeat(64)}`;
const TEXT = "Took it for a week — felt nothing. “Cancelled”.\nSecond line, kept.";

const ledger = (): ReviewLedgerSnapshot => ({
  pulls: [
    {
      handle: "p1",
      source_id: HASH,
      target_id: "product",
      platform: "amazon",
      listing: "https://www.amazon.com/dp/B0H2JVQ9GR",
      band_requested: 3,
      fetched_at: "2026-09-25T12:00:00Z",
      archived: true,
      total_reviews: 40,
      total_ratings: 25331,
      gap: null,
    },
  ],
  reviews: [
    {
      ref: "r1.1",
      pull: "p1",
      platform: "amazon",
      review_key: "R1",
      listing: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      title: "slow",
      text: TEXT,
      posted_at: "2026-05-19",
      verified: true,
      locator: "R1",
    },
  ],
});

const draft = () =>
  reviewPacket({
    measurements: [
      { id: "m1", node: "review_mining", metric: "ratings_total", value: 25331, source_id: "p1" },
    ],
  });

describe("assembling the review half of a packet", () => {
  it("writes the excerpt from the ledger, byte for byte, citing the pull's hash", () => {
    const packet = new PacketValidator(ledger()).validate(
      draft(),
      ["review_mining"],
    );
    const excerpt = packet.excerpts.find((e) => e.id === "r1.1")!;
    expect(excerpt.text).toBe(TEXT);
    expect(excerpt.source_id).toBe(HASH);
    expect(excerpt.star_rating).toBe(3);
    expect(excerpt.axis).toBeNull();
    expect(excerpt.captured_at).toBe("2026-09-25T12:00:00Z");
    expect(excerpt.locator).toMatchObject({ kind: "note", note: "review id R1" });
    expect(packet.sources.find((s) => s.id === HASH)?.kind).toBe("marketplace_review");
    expect(packet.measurements[0]!.source_id).toBe(HASH);
  });

  it("gives the same packet when expanded twice, so the check tool and settlement agree", () => {
    const assembly = new ReviewAssembly(ledger());
    const once = assembly.expand(draft());
    expect(assembly.expand(once)).toEqual(once);
  });

  it("does not paper over a malformed field; the contract still reports it", () => {
    const bad = { ...draft(), excerpts: "none" };
    expect(new ReviewAssembly(ledger()).expand(bad).excerpts).toBe("none");
  });
});
