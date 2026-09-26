import { createInterface } from "node:readline/promises";
import { stderr, stdin, stdout } from "node:process";
import { Trace } from "../trace/index.js";

/** Reads a line without echoing it; piped, it prompts on stderr and reads every answer from one reader. */
export class SecretPrompt {
  private piped: AsyncIterator<string> | null = null;

  readonly ask = async (question: string): Promise<string> => {
    Trace.line(import.meta.url, "SecretPrompt.ask", { question });
    if (!stdin.isTTY) return await this.nextPiped(question);
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const original = stdout.write.bind(stdout);
    let muted = false;
    (stdout as any).write = (chunk: string, ...rest: unknown[]) =>
      muted && typeof chunk === "string" ? true : (original as any)(chunk, ...rest);
    try {
      const pending = rl.question(question);
      muted = true;
      return await pending;
    } finally {
      muted = false;
      (stdout as any).write = original;
      stdout.write("\n");
      rl.close();
    }
  };

  static async newPassword(ask: (question: string) => Promise<string>): Promise<string> {
    Trace.line(import.meta.url, "SecretPrompt.newPassword", { ask });
    const password = await ask("Password: ");
    const again = await ask("Again: ");
    if (password !== again) throw new Error("passwords do not match");
    if (password.length < 12) throw new Error("use at least 12 characters");
    return password;
  }

  private async nextPiped(question: string): Promise<string> {
    Trace.line(import.meta.url, "SecretPrompt.nextPiped", { question });
    stderr.write(question);
    this.piped ??= createInterface({ input: stdin, terminal: false })[Symbol.asyncIterator]();
    const line = await this.piped.next();
    stderr.write("\n");
    return line.done ? "" : String(line.value).trim();
  }
}
