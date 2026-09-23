import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Settings } from "../config/index.js";

import { Passwords } from "./passwords.js";
import { TokenService } from "./token-service.js";

/** The session routes and the middleware guarding /api/research. */
export class AuthGate {
  private static readonly COOKIE = "mra_session";
  private readonly tokens: TokenService | null;
  private readonly authRequired: boolean;

  constructor(private readonly settings: Settings) {
    this.authRequired = Boolean(settings.appPasswordHash);
    if (!this.authRequired) {
      console.warn("MRA_APP_PASSWORD_HASH is empty — authentication is DISABLED");
    }
    this.tokens = this.authRequired
      ? new TokenService(settings.jwtSecret, { sessionHours: settings.sessionHours })
      : null;
  }

  register(app: Hono): void {
    app.get("/api/auth/session", async (c) => {
      if (!this.authRequired) {
        return c.json({ authenticated: true, user: this.settings.appUser, auth_required: false });
      }
      const subject = await this.currentUser(getCookie(c, AuthGate.COOKIE));
      return c.json({ authenticated: Boolean(subject), user: subject, auth_required: true });
    });

    app.post("/api/auth/login", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        username?: unknown;
        password?: unknown;
      };
      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";
      const ok =
        username === this.settings.appUser &&
        Boolean(this.settings.appPasswordHash) &&
        (await Passwords.verify(password, this.settings.appPasswordHash));
      if (!ok || !this.tokens) return c.json({ detail: "invalid credentials" }, 401);
      setCookie(c, AuthGate.COOKIE, await this.tokens.issue(username), {
        httpOnly: true,
        secure: this.settings.cookieSecure,
        sameSite: "Lax",
        maxAge: this.settings.sessionHours * 3600,
        path: "/",
      });
      return c.json({ user: username });
    });

    app.post("/api/auth/logout", (c) => {
      deleteCookie(c, AuthGate.COOKIE, { path: "/" });
      return c.json({ ok: true });
    });

    app.use("/api/research/*", async (c, next) => {
      const subject = await this.currentUser(getCookie(c, AuthGate.COOKIE));
      if (!subject) return c.json({ detail: "not authenticated" }, 401);
      await next();
    });
  }

  private async currentUser(token: string | undefined): Promise<string | null> {
    if (!this.authRequired) return this.settings.appUser;
    if (!token || !this.tokens) return null;
    return await this.tokens.verify(token);
  }
}
