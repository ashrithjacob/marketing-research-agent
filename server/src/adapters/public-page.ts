import type { Settings } from "../config/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";
import { PublicUrls } from "./public-urls.js";

/** Fetches a public page directly from this server, the way a browser would: never from localhost or a private network, and every redirect checked again before it is followed. */
export class PublicPage {
  static readonly MAX_REDIRECTS = 3;
  static readonly USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36";

  constructor(private readonly settings: Settings) {}

  async text(url: string, accept: string, signal?: AbortSignal): Promise<{ url: string; body: string }> {
    Trace.line(import.meta.url, "PublicPage.text", { url });
    let next = url;
    for (let hop = 0; hop <= PublicPage.MAX_REDIRECTS; hop++) {
      const init: RequestInit = { headers: { "User-Agent": PublicPage.USER_AGENT, Accept: accept }, redirect: "manual" };
      const response = await Http.withTimeout(PublicUrls.assert(next).toString(), init, this.settings.webTimeoutSeconds, signal);
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        next = new URL(location, next).toString();
        continue;
      }
      if (!response.ok) throw new Error(`${next} returned ${response.status}`);
      return { url: next, body: await response.text() };
    }
    throw new Error(`${url} redirected more than ${PublicPage.MAX_REDIRECTS} times`);
  }
}
