import { randomUUID } from "node:crypto";

import type { Settings } from "../config/index.js";
import { ADMIN_ACCOUNT, type AccountDirectory, type Principal, type User } from "../domain/index.js";

import { Passwords } from "./passwords.js";
import { TokenService } from "./token-service.js";
import { Trace } from "../trace/index.js";

/** Turns a username and password into a session token, and a token back into the user it still belongs to. */
export class Sessions {
  private readonly tokens: TokenService;
  private readonly decoyHash: Promise<string> = Passwords.hash(randomUUID());

  constructor(
    private readonly accounts: AccountDirectory,
    settings: Settings,
  ) {
    Trace.line(import.meta.url, "Sessions.constructor");
    this.tokens = new TokenService(settings.jwtSecret, { sessionHours: settings.sessionHours });
  }

  async login(username: string, password: string): Promise<{ token: string; principal: Principal } | null> {
    Trace.line(import.meta.url, "Sessions.login", { username, password });
    const user = await this.accounts.byUsername(username);
    const matches = await Passwords.verify(password, user?.password_hash ?? (await this.decoyHash));
    if (!user || user.disabled || !matches) return null;
    return {
      token: await this.tokens.issue(user.id, user.token_version),
      principal: Sessions.principal(user),
    };
  }

  async resolve(token: string | undefined): Promise<Principal | null> {
    Trace.line(import.meta.url, "Sessions.resolve", { token });
    if (!token) return null;
    const claims = await this.tokens.verify(token);
    if (!claims) return null;
    const user = await this.accounts.user(claims.subject);
    if (!user || user.disabled || user.token_version !== claims.version) return null;
    return Sessions.principal(user);
  }

  async revoke(principal: Principal): Promise<void> {
    Trace.line(import.meta.url, "Sessions.revoke", { principal });
    await this.accounts.revokeSessions(principal.userId);
  }

  static local(username: string): Principal {
    Trace.line(import.meta.url, "Sessions.local", { username });
    return { userId: "local", username, accountId: ADMIN_ACCOUNT, isAdmin: true };
  }

  private static principal(user: User): Principal {
    Trace.line(import.meta.url, "Sessions.principal", { userId: user.id });
    return {
      userId: user.id,
      username: user.username,
      accountId: user.account_id,
      isAdmin: user.is_admin,
    };
  }
}
