import { Trace } from "../trace/index.js";

export const ADMIN_ACCOUNT = "admin";

/** A client: every row of research belongs to exactly one, and no client sees another's. */
export interface Account {
  id: string;
  name: string;
  vertical: string;
  markets: string[];
  created_at: string;
}

/** A login, belonging to one account. */
export interface User {
  id: string;
  username: string;
  password_hash: string;
  account_id: string;
  is_admin: boolean;
  token_version: number;
  disabled: boolean;
  created_at: string;
}

export interface UserListing {
  username: string;
  account: string;
  is_admin: boolean;
  disabled: boolean;
  created_at: string;
}

/** Who a request is acting as, once its session has been checked. */
export interface Principal {
  userId: string;
  username: string;
  accountId: string;
  isAdmin: boolean;
}

/** Which account's rows a read may return; `everything` is for an admin and for the server itself. */
export class Scope {
  private constructor(readonly accountId: string | null) {}

  static readonly everything = new Scope(null);

  static of(accountId: string): Scope {
    Trace.line(import.meta.url, "Scope.of", { accountId });
    return new Scope(accountId);
  }

  static forViewer(principal: Principal): Scope {
    Trace.line(import.meta.url, "Scope.forViewer", { principal });
    return principal.isAdmin ? Scope.everything : Scope.of(principal.accountId);
  }

  admits(accountId: string): boolean {
    Trace.line(import.meta.url, "Scope.admits", { accountId });
    return this.accountId === null || this.accountId === accountId;
  }
}
