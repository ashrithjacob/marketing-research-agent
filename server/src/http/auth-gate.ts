import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Settings } from "../config/index.js";
import type { AccountDirectory, Principal } from "../domain/index.js";

import type { ApiEnv } from "./api-env.js";
import { LoginThrottle } from "./login-throttle.js";
import { Sessions } from "./sessions.js";
import { Trace } from "../trace/index.js";

/** The session routes, and the middleware that puts a principal on every /api/research request. */
export class AuthGate {
  private static readonly COOKIE = "mra_session";
  private readonly sessions: Sessions | null;
  private readonly throttle = new LoginThrottle();

  constructor(
    private readonly settings: Settings,
    private readonly accounts: AccountDirectory,
  ) {
    Trace.line(import.meta.url, "AuthGate.constructor");
    if (!settings.appPasswordHash) {
      console.warn("MRA_APP_PASSWORD_HASH is empty — authentication is DISABLED");
      this.sessions = null;
      return;
    }
    if (accounts.seedAdmin(settings.appUser, settings.appPasswordHash)) {
      console.log(`seeded admin account ${JSON.stringify(settings.appUser)} from MRA_APP_*`);
    }
    this.sessions = new Sessions(accounts, settings);
  }

  register(app: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "AuthGate.register");
    app.get("/api/auth/session", async (c) => {
      const principal = await this.principal(c);
      if (!principal) return c.json({ authenticated: false, user: null, auth_required: true });
      return c.json({
        authenticated: true,
        user: principal.username,
        workspace: this.accounts.workspace(principal.workspaceId)?.name ?? principal.workspaceId,
        is_admin: principal.isAdmin,
        auth_required: this.sessions !== null,
      });
    });

    app.post("/api/auth/login", async (c) => this.login(c));

    app.post("/api/auth/logout", async (c) => {
      const principal = this.sessions ? await this.principal(c) : null;
      if (principal) this.sessions?.revoke(principal);
      deleteCookie(c, AuthGate.COOKIE, { path: "/" });
      return c.json({ ok: true });
    });

    app.use("/api/research/*", async (c, next) => {
      const principal = await this.principal(c);
      if (!principal) return c.json({ detail: "not authenticated" }, 401);
      c.set("principal", principal);
      await next();
    });
  }

  private async login(c: Context<ApiEnv>) {
    Trace.line(import.meta.url, "AuthGate.login");
    if (!this.sessions) return c.json({ detail: "authentication is disabled" }, 400);
    const client = LoginThrottle.clientOf(c.req.header("X-Forwarded-For"));
    const wait = this.throttle.retryAfterSeconds(client);
    if (wait > 0) {
      c.header("Retry-After", String(wait));
      return c.json({ detail: "too many failed logins; try again later" }, 429);
    }
    const body = (await c.req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const session = await this.sessions.login(username, password);
    if (!session) {
      this.throttle.fail(client);
      return c.json({ detail: "invalid credentials" }, 401);
    }
    this.throttle.clear(client);
    setCookie(c, AuthGate.COOKIE, session.token, {
      httpOnly: true,
      secure: this.settings.cookieSecure,
      sameSite: "Lax",
      maxAge: this.settings.sessionHours * 3600,
      path: "/",
    });
    return c.json({ user: session.principal.username });
  }

  private async principal(c: Context<ApiEnv>): Promise<Principal | null> {
    Trace.line(import.meta.url, "AuthGate.principal");
    if (!this.sessions) return Sessions.local(this.settings.appUser);
    return await this.sessions.resolve(getCookie(c, AuthGate.COOKIE));
  }
}
