/**
 * Packets that validate. Tests mutate one thing and assert the failure.
 *
 * Two of them, because review mining became stage 2 on 2026-09-21: a packet
 * belongs to one stage, and the validator rejects one that mixes them.
 */

/** Stage 1: the product, its competitors, its category. */
export function minimalPacket(overrides: Record<string, unknown> = {}): Record<string, any> {
  const data: Record<string, any> = {
    contract_version: "1",
    stage: 1,
    brief: { product: "MagnaCalm 400mg", url: "https://x", market: "UK" },
    sources: [
      {
        id: "sha256:aaa",
        url: "https://magnacalm.example/products/glycinate-400",
        kind: "first_party",
        publisher: "magnacalm.example",
        fetched_at: "2026-09-10T09:00:00Z",
        marketing: true,
        admitted: true,
        admission_reason: "first_party — the product's own page",
        archived: true,
        node: "product_data",
      },
    ],
    attributes: [
      {
        id: "a1",
        node: "product_data",
        key: "dose_per_serving",
        value: "400 mg",
        source_id: "sha256:aaa",
      },
    ],
    // product_data is the one node whose done-criterion is a checklist, so it
    // needs no saturation curve — which keeps this fixture minimal.
    nodes: [
      {
        node: "product_data",
        status: "complete",
        done_criterion_met: true,
        why: "9 of 10 attributes; COA gapped",
      },
    ],
    gaps: [
      {
        node: "product_data",
        missing: "no certificate of analysis published",
        would_need: "a batch COA on request",
        blocking: false,
      },
    ],
  };
  return { ...data, ...overrides };
}

/** Stage 2: verbatim customer language, with its 3★ excerpt. */
export function reviewPacket(overrides: Record<string, unknown> = {}): Record<string, any> {
  const data: Record<string, any> = {
    contract_version: "1",
    stage: 2,
    brief: { product: "MagnaCalm 400mg", url: "https://x", market: "UK" },
    sources: [
      {
        id: "sha256:aaa",
        url: "https://reddit.com/r/insomnia/1",
        kind: "forum",
        publisher: "reddit.com",
        fetched_at: "2026-09-10T09:00:00Z",
        admitted: true,
        admission_reason: "forum — default policy",
        archived: true,
        node: "review_mining",
      },
    ],
    excerpts: [
      {
        id: "sha256:bbb",
        source_id: "sha256:aaa",
        text: "I wake up at 3am and can't get back to sleep.",
        captured_at: "2026-09-10T09:00:01Z",
        node: "review_mining",
        star_rating: 3,
        axis: "why_quit",
        themes: ["3am waking"],
      },
    ],
    saturation: [
      {
        node: "review_mining",
        curve: [{ source_id: "sha256:aaa", new_themes: 1, cumulative_themes: 1 }],
        stopped_because: "three consecutive sources added no new theme",
      },
    ],
    nodes: [
      {
        node: "review_mining",
        status: "complete",
        done_criterion_met: true,
        why: "saturated",
      },
    ],
    gaps: [
      {
        node: "review_mining",
        missing: "no Trustpilot presence for this brand",
        would_need: "a merchant profile to exist",
        blocking: false,
      },
    ],
  };
  return { ...data, ...overrides };
}

export function fenced(data: unknown, prose = "Here is the packet."): string {
  return `${prose}\n\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n`;
}
