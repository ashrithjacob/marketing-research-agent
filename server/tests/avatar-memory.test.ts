/** The avatar memory's rules, pure: what an update may do to it, how it is applied, and what code counts from it. */
import { describe, expect, it } from "vitest";

import { MemoryUpdateSchema, Schemas, type AvatarMemory, type MemoryUpdate, type ReadAd } from "../src/domain/index.js";
import { AvatarMemoryBook, AvatarMemoryCheck, AvatarTally } from "../src/extract/index.js";

const profile = { pains: [], desires: [], triggers: [], prior_solutions: [], objections: [], outcomes: [], angles: [] };
const update = (raw: Record<string, unknown>): MemoryUpdate => {
  const parsed = Schemas.parse(MemoryUpdateSchema, raw);
  if (!parsed.ok) throw new Error(parsed.problems.join("; "));
  return parsed.value;
};

const smokers = { key: "ex_smokers", parent: null, name: "Ex-smokers", description: "Quit and still cough.", ...profile };
const first = AvatarMemoryBook.apply(
  AvatarMemoryBook.empty(),
  update({ create: [smokers], assign: [{ review_id: "r1", avatar: "ex_smokers" }, { review_id: "r2", avatar: null }], quotes: [{ avatar: "ex_smokers", review_id: "r1" }] }),
);

describe("an update to the memory", () => {
  it("must assign every review in its batch exactly once, and nothing outside it", () => {
    const problems = AvatarMemoryCheck.problems(first, update({ assign: [{ review_id: "r3", avatar: "ex_smokers" }, { review_id: "r3", avatar: null }, { review_id: "x9", avatar: null }] }), ["r3", "r4"]);
    expect(problems).toEqual([
      "assign r3: assigned twice",
      "assign x9: that review is not in this batch; copy each id exactly",
      "1 review(s) in this batch are not assigned: r4",
    ]);
  });

  it("may not name an avatar that does not exist, nest three deep, or quote a review assigned elsewhere", () => {
    const problems = AvatarMemoryCheck.problems(
      first,
      update({
        create: [{ ...smokers, key: "vapers", parent: "ex_smokers" }, { ...smokers, key: "deep", parent: "vapers" }],
        revise: [{ key: "ghost", name: "x" }],
        assign: [{ review_id: "r3", avatar: "nobody" }],
        quotes: [{ avatar: "vapers", review_id: "r1" }],
      }),
      ["r3"],
    );
    expect(problems).toEqual([
      "create deep: vapers is itself a sub-avatar; two levels at most",
      "revise: avatar ghost does not exist",
      "assign: avatar nobody does not exist",
      "quote r1: it is not assigned to vapers",
    ]);
  });
});

describe("applying an update", () => {
  it("keeps the memory's reviews and quotes by id, and a merge carries them, and sub-avatars, to the avatar it folds into", () => {
    expect(first.avatars[0]).toMatchObject({ key: "ex_smokers", review_ids: ["r1"], quote_ids: ["r1"] });
    expect(first.unassigned_review_ids).toEqual(["r2"]);
    const merged = AvatarMemoryBook.apply(
      first,
      update({
        create: [{ ...smokers, key: "smokers_quitting", name: "Quitting" }, { ...smokers, key: "vapers", parent: "smokers_quitting", name: "Vapers" }],
        assign: [{ review_id: "r3", avatar: "smokers_quitting" }],
        merge: [{ from: "smokers_quitting", into: "ex_smokers" }],
      }),
    );
    expect(merged.avatars.map((avatar) => [avatar.key, avatar.parent, avatar.review_ids])).toEqual([["ex_smokers", null, ["r1", "r3"]], ["vapers", "ex_smokers", []]]);
    expect(merged.batches_read).toBe(2);
  });
});

describe("the tally", () => {
  it("counts a parent with its sub-avatars, shares over everything assigned, and win rate over the avatar's own ads", () => {
    const memory: AvatarMemory = {
      batches_read: 3,
      unassigned_review_ids: ["r9"],
      avatars: [
        { ...smokers, review_ids: ["r1", "r2"], quote_ids: [], ad_ids: ["a1", "a2"] },
        { ...smokers, key: "vapers", parent: "ex_smokers", review_ids: ["r3"], quote_ids: [], ad_ids: [] },
        { ...smokers, key: "parents", review_ids: ["r4"], quote_ids: [], ad_ids: [] },
      ],
    };
    const ads = [{ id: "a1", bucket: "winning" }, { id: "a2", bucket: "dead" }] as ReadAd[];
    const records = AvatarTally.records(memory, null, ads);
    expect(records.map((r) => [r.avatar.key, r.avatar.review_count, r.avatar.demand_share, r.avatar.supply_share, r.avatar.win_rate, r.avatar.standing])).toEqual([
      ["ex_smokers", 3, 0.75, 1, 0.5, "emerging"],
      ["vapers", 1, 0.25, 0, null, "emerging"],
      ["parents", 1, 0.25, 0, null, "emerging"],
    ]);
  });
});
