import { Trace } from "../trace/index.js";

export const ADMIN_WORKSPACE = "admin";

export interface Workspace {
  id: string;
  name: string;
  billing_status: string;
  created_at: string;
}

export interface Account {
  id: string;
  username: string;
  password_hash: string;
  workspace_id: string;
  is_admin: boolean;
  token_version: number;
  disabled: boolean;
  created_at: string;
}

export interface AccountListing {
  username: string;
  workspace: string;
  is_admin: boolean;
  disabled: boolean;
  created_at: string;
}

/** Who a request is acting as, once its session has been checked. */
export interface Principal {
  userId: string;
  username: string;
  workspaceId: string;
  isAdmin: boolean;
}

/** Which workspace's rows a read may return; `everything` is for an admin and for the server itself. */
export class Scope {
  private constructor(readonly workspaceId: string | null) {}

  static readonly everything = new Scope(null);

  static of(workspaceId: string): Scope {
    Trace.line(import.meta.url, "Scope.of", { workspaceId });
    return new Scope(workspaceId);
  }

  static forViewer(principal: Principal): Scope {
    Trace.line(import.meta.url, "Scope.forViewer", { principal });
    return principal.isAdmin ? Scope.everything : Scope.of(principal.workspaceId);
  }

  admits(workspaceId: string): boolean {
    Trace.line(import.meta.url, "Scope.admits", { workspaceId });
    return this.workspaceId === null || this.workspaceId === workspaceId;
  }
}
