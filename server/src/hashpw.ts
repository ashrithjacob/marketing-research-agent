import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { Passwords } from "./http/index.js";

/** Read a line without echoing it. Falls back to a visible prompt when stdin is not a tty. */
async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  if (!stdin.isTTY) {
    try {
      return (await rl.question(question)).trim();
    } finally {
      rl.close();
    }
  }
  const output = stdout as unknown as { write(chunk: string): boolean; muted?: boolean };
  const original = output.write.bind(stdout);
  let muted = false;
  (stdout as any).write = (chunk: string, ...rest: unknown[]) =>
    muted && typeof chunk === "string" ? true : (original as any)(chunk, ...rest);
  try {
    const pending = rl.question(question);
    muted = true;
    const answer = await pending;
    return answer;
  } finally {
    muted = false;
    (stdout as any).write = original;
    stdout.write("\n");
    rl.close();
  }
}

async function main(): Promise<void> {
  const password = await prompt("Password: ");
  const again = await prompt("Again: ");
  if (password !== again) {
    console.error("passwords do not match");
    process.exit(1);
  }
  if (!password) {
    console.error("password is empty");
    process.exit(1);
  }
  console.log(await Passwords.hash(password));
}

await main();
