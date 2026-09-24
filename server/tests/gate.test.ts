/**
 * The fetch gate.
 *
 * The gate sits between Firecrawl and the researcher's context. Its one rule
 * is that it may never eat a source: anything uncertain — an HTTP error, a
 * timeout, an unparseable answer — admits the page. The tests pin both the
 * happy paths and every fail-open path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterGate } from "../src/adapters/fetch-gate.js";
import { Env, type Settings } from "../src/config/index.js";

let settings: Settings;

beforeEach(() => {
  settings = {
    ...Env.settings(),
    openrouterApiKey: "test-key",
    gateModel: "qwen/qwen3.8-27b:free",
    gateCharLimit: 4000,
    gateTimeoutSeconds: 12,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

const page = {
  url: "https://example.com/product",
  title: "Example product",
  body: "x".repeat(5000),
  subject: "Mullein leaf capsules",
  market: "UK",
};

describe("OpenRouterGate", () => {
  it("admits when the model says admit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => completion('{"admit": true, "reason": "product page"}')),
    );
    const verdict = await new OpenRouterGate(settings).admit(page);
    expect(verdict.admit).toBe(true);
    expect(verdict.reason).toBe("product page");
    expect(verdict.model).toBe("qwen/qwen3.8-27b:free");
    expect(verdict.ms).toBeGreaterThanOrEqual(0);
  });

  it("blocks when the model names the reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => completion('{"admit": false, "reason": "captcha wall"}')),
    );
    const verdict = await new OpenRouterGate(settings).admit(page);
    expect(verdict.admit).toBe(false);
    expect(verdict.reason).toBe("captcha wall");
  });

  it("sends the model, the subject and a capped body sample", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return completion('{"admit": true, "reason": "ok"}');
      }),
    );
    await new OpenRouterGate(settings).admit(page);
    expect(calls[0]!.url).toContain("openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(calls[0]!.init!.body));
    expect(body.model).toBe("qwen/qwen3.8-27b:free");
    expect(body.messages[1].content).toContain("Product or site: Mullein leaf capsules");
    expect(body.messages[1].content).toContain("Markets: UK");
    const sample = body.messages[1].content.split("Page text:\n")[1];
    expect(sample.length).toBe(4000);
  });

  it("admits on an HTTP error — the gate never eats a source", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const verdict = await new OpenRouterGate(settings).admit(page);
    expect(verdict.admit).toBe(true);
    expect(verdict.reason).toContain("gate failed open");
  });

  it("admits an answer with no JSON, and an unparseable one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completion("sorry, I cannot answer that")));
    const noJson = await new OpenRouterGate(settings).admit(page);
    expect(noJson.admit).toBe(true);
    expect(noJson.reason).toContain("no JSON");

    vi.stubGlobal("fetch", vi.fn(async () => completion("{admit: maybe}")));
    const unparseable = await new OpenRouterGate(settings).admit(page);
    expect(unparseable.admit).toBe(true);
    expect(unparseable.reason).toContain("unparseable");
  });

  it("reads admit:false only from exactly false", async () => {
    expect(OpenRouterGate.parse('{"admit": false, "reason": "spam"}').admit).toBe(false);
    expect(OpenRouterGate.parse('{"admit": true}').admit).toBe(true);
    expect(OpenRouterGate.parse('{"reason": "no admit field"}').admit).toBe(true);
    expect(OpenRouterGate.parse('{"admit": "false", "reason": "a string is not false"}').admit).toBe(true);
  });
});
