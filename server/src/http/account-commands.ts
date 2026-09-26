import { ADMIN_WORKSPACE, type AccountDirectory } from "../domain/index.js";

import { Passwords } from "./passwords.js";
import { SecretPrompt } from "./secret-prompt.js";
import { Trace } from "../trace/index.js";

/** The admin CLI for workspaces and logins: there is no signup page, so this is how an account comes to exist. */
export class AccountCommands {
  static readonly USAGE = [
    "usage: accounts <command>",
    "  list",
    "  add-workspace <name>",
    "  add-user <username> <workspace> [--admin]",
    "  reset-password <username>",
    "  disable <username>",
    "  enable <username>",
  ].join("\n");

  private static readonly NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

  constructor(
    private readonly accounts: AccountDirectory,
    private readonly ask: (question: string) => Promise<string>,
    private readonly out: (line: string) => void,
  ) {}

  async run(argv: readonly string[]): Promise<number> {
    Trace.line(import.meta.url, "AccountCommands.run", { argv });
    const [command, first, second] = argv;
    try {
      if (command === "list") return this.list();
      if (command === "add-workspace" && first) return this.addWorkspace(first);
      if (command === "add-user" && first && second) {
        return await this.addUser(first, second, argv.includes("--admin"));
      }
      if (command === "reset-password" && first) return await this.resetPassword(first);
      if (command === "disable" && first) return this.setDisabled(first, true);
      if (command === "enable" && first) return this.setDisabled(first, false);
    } catch (error) {
      this.out(`error: ${(error as Error).message}`);
      return 1;
    }
    this.out(AccountCommands.USAGE);
    return 2;
  }

  private list(): number {
    Trace.line(import.meta.url, "AccountCommands.list");
    for (const a of this.accounts.list()) {
      const flags = [a.is_admin ? "admin" : "", a.disabled ? "DISABLED" : ""].filter(Boolean).join(",");
      this.out(`${a.workspace}\t${a.username}\t${flags}`);
    }
    return 0;
  }

  private addWorkspace(name: string): number {
    Trace.line(import.meta.url, "AccountCommands.addWorkspace", { name });
    if (!AccountCommands.NAME.test(name)) throw new Error("a workspace name is lowercase letters, digits and dashes");
    if (this.accounts.workspaceNamed(name)) throw new Error(`workspace ${name} already exists`);
    this.out(`created workspace ${this.accounts.addWorkspace(name).name}`);
    return 0;
  }

  private async addUser(username: string, workspaceName: string, isAdmin: boolean): Promise<number> {
    Trace.line(import.meta.url, "AccountCommands.addUser", { username, workspaceName, isAdmin });
    const workspace = this.accounts.workspaceNamed(workspaceName);
    if (!workspace) throw new Error(`no workspace ${workspaceName}; add-workspace it first`);
    if (this.accounts.byUsername(username)) throw new Error(`user ${username} already exists`);
    if (isAdmin && workspace.id !== ADMIN_WORKSPACE) throw new Error("admins belong to the admin workspace");
    const passwordHash = await Passwords.hash(await SecretPrompt.newPassword(this.ask));
    this.accounts.addAccount({ username, passwordHash, workspaceId: workspace.id, isAdmin });
    this.out(`created ${username} in ${workspace.name}`);
    return 0;
  }

  private async resetPassword(username: string): Promise<number> {
    Trace.line(import.meta.url, "AccountCommands.resetPassword", { username });
    if (!this.accounts.byUsername(username)) throw new Error(`no user ${username}`);
    const passwordHash = await Passwords.hash(await SecretPrompt.newPassword(this.ask));
    this.accounts.setPassword(username, passwordHash);
    this.out(`password changed for ${username}; their existing sessions are signed out`);
    return 0;
  }

  private setDisabled(username: string, disabled: boolean): number {
    Trace.line(import.meta.url, "AccountCommands.setDisabled", { username, disabled });
    if (!this.accounts.setDisabled(username, disabled)) throw new Error(`no user ${username}`);
    this.out(`${username} ${disabled ? "disabled and signed out" : "enabled"}`);
    return 0;
  }
}
