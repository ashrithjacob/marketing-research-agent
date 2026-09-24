import type { FetchGate, GateVerdict } from "../domain/ports.js";
import type { Settings } from "../config/index.js";

const GATE_INSTRUCTION =
  "You gate web fetches for a product-research agent. Decide in one step whether " +
  "this fetched page is worth the researcher's reading. ADMIT pages about the " +
  "product, its brand, its ingredients or components, its competitors, its " +
  "category, its markets, reviews of any of these, or shopping guides. BLOCK " +
  "error pages, bot walls, captchas, login walls, empty or navigation-only " +
  "shells, and pages about a different subject entirely. If unsure, ADMIT — a " +
  "wasted read costs less than a lost source. Answer with exactly one JSON " +
  'object and nothing else: {"admit": true|false, "reason": "at most twelve words"}';

/** The cheapest model that can read a page before the researcher does. */
export class OpenRouterGate implements FetchGate {
  constructor(private readonly settings: Settings) {}

  async admit(input: {
    url: string;
    title: string;
    body: string;
    subject: string;
    market: string;
  }): Promise<GateVerdict> {
    const started = Date.now();
    const model = this.settings.gateModel;
    try {
      const answer = await this.ask(model, input);
      const parsed = OpenRouterGate.parse(answer);
      const verdict: GateVerdict = {
        admit: parsed.admit,
        reason: parsed.reason,
        model,
        ms: Date.now() - started,
      };
      console.log(
        `fetch gate: ${verdict.admit ? "admit" : "BLOCK"} ${input.url} — ` +
          `${verdict.reason} (${verdict.ms}ms)`,
      );
      return verdict;
    } catch (error) {
      const ms = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`fetch gate: admit ${input.url} — failed open after ${ms}ms: ${message}`);
      return {
        admit: true,
        reason: `gate failed open: ${message}`,
        model,
        ms,
      };
    }
  }

  /** Thinking models need headroom and a forced schema, or the JSON never arrives. */
  private async ask(
    model: string,
    input: { url: string; title: string; body: string; subject: string; market: string },
  ): Promise<string> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.openrouterApiKey}`,
      },
      signal: AbortSignal.any([
        AbortSignal.timeout(this.settings.gateTimeoutSeconds * 1000),
      ]),
      body: JSON.stringify({
        model,
        max_tokens: 512,
        temperature: 0,
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "gate_verdict",
            strict: true,
            schema: {
              type: "object",
              properties: {
                admit: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["admit", "reason"],
              additionalProperties: false,
            },
          },
        },
        messages: [
          { role: "system", content: GATE_INSTRUCTION },
          {
            role: "user",
            content: [
              `Product or site: ${input.subject || "unknown"}`,
              `Markets: ${input.market || "any"}`,
              `URL: ${input.url}`,
              `Title: ${input.title}`,
              "",
              "Page text:",
              input.body.slice(0, this.settings.gateCharLimit),
            ].join("\n"),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty completion");
    return content;
  }

  /** Anything that is not exactly admit:false is an admit — the gate never eats a source. */
  static parse(answer: string): { admit: boolean; reason: string } {
    const match = answer.match(/\{[\s\S]*\}/);
    if (!match) return { admit: true, reason: "gate answer had no JSON" };
    try {
      const parsed = JSON.parse(match[0]) as { admit?: unknown; reason?: unknown };
      if (parsed.admit === false) {
        return { admit: false, reason: String(parsed.reason ?? "not relevant") };
      }
      return { admit: true, reason: String(parsed.reason ?? "") };
    } catch {
      return { admit: true, reason: "gate answer unparseable" };
    }
  }
}
