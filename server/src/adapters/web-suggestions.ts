import type { Settings } from "../config/index.js";
import { SourceMarkets, type Market, type SearchSuggestions, type SuggestionSource } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

/** Google's and Amazon's search-box completions, both free and answering a plain request (seen 2026-10-20). Amazon is read only where its completion host was seen working: the US and the UK. */
export class WebSuggestions implements SearchSuggestions {
  static readonly USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36";

  constructor(private readonly settings: Settings) {}

  async suggest(seed: string, source: SuggestionSource, country: string, signal?: AbortSignal): Promise<string[]> {
    Trace.line(import.meta.url, "WebSuggestions.suggest", { seed, source, country });
    if (source === "google") {
      const query = new URLSearchParams({ client: "firefox", q: seed, gl: country, hl: "en" });
      const body = await this.json(`https://suggestqueries.google.com/complete/search?${query}`, signal);
      return Array.isArray(body) && Array.isArray(body[1]) ? (body[1] as unknown[]).map(String) : [];
    }
    const amazon = SourceMarkets.amazonSuggest(country.toUpperCase() === "UK" ? "GB" : (country.toUpperCase() as Market));
    if (!amazon) throw new Error(`Amazon completions are not available for ${country}; only the US and the UK were seen working`);
    const query = new URLSearchParams({ mid: amazon.mid, alias: "aps", prefix: seed });
    const body = (await this.json(`https://${amazon.host}/api/2017/suggestions?${query}`, signal)) as { suggestions?: Array<{ value?: string }> };
    return (body.suggestions ?? []).map((item) => item.value ?? "").filter((value) => value !== "");
  }

  private async json(url: string, signal?: AbortSignal): Promise<unknown> {
    Trace.line(import.meta.url, "WebSuggestions.json", { url });
    const response = await Http.withTimeout(url, { headers: { "User-Agent": WebSuggestions.USER_AGENT, Accept: "application/json" } }, this.settings.webTimeoutSeconds, signal);
    if (!response.ok) throw new Error(`${new URL(url).host} returned ${response.status}`);
    return response.json();
  }
}
