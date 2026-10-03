import { randomUUID } from "node:crypto";

import type { Settings } from "../config/index.js";
import { ADMIN_WORKSPACE, type Account, type AccountDirectory, type Principal } from "../domain/index.js";

import { Passwords } from "./passwords.js";
import { TokenService } from "./token-service.js";
import { Trace } from "../trace/index.js";

/** Turns a username and password into a session token, and a token back into the account it still belongs to. */
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
    const account = await this.accounts.byUsername(username);
    const matches = await Passwords.verify(password, account?.password_hash ?? (await this.decoyHash));
    if (!account || account.disabled || !matches) return null;
    return {
      token: await this.tokens.issue(account.id, account.token_version),
      principal: Sessions.principal(account),
    };
  }

  async resolve(token: string | undefined): Promise<Principal | null> {
    Trace.line(import.meta.url, "Sessions.resolve", { token });
    if (!token) return null;
    const claims = await this.tokens.verify(token);
    if (!claims) return null;
    const account = await this.accounts.get(claims.subject);
    if (!account || account.disabled || account.token_version !== claims.version) return null;
    return Sessions.principal(account);
  }

  async revoke(principal: Principal): Promise<void> {
    Trace.line(import.meta.url, "Sessions.revoke", { principal });
    await this.accounts.revokeSessions(principal.userId);
  }

  static local(username: string): Principal {
    Trace.line(import.meta.url, "Sessions.local", { username });
    return { userId: "local", username, workspaceId: ADMIN_WORKSPACE, isAdmin: true };
  }

  private static principal(account: Account): Principal {
    Trace.line(import.meta.url, "Sessions.principal", { account });
    return {
      userId: account.id,
      username: account.username,
      workspaceId: account.workspace_id,
      isAdmin: account.is_admin,
    };
  }
}
