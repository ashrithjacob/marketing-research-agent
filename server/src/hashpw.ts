import { Passwords, SecretPrompt } from "./http/index.js";

try {
  console.log(await Passwords.hash(await SecretPrompt.newPassword(new SecretPrompt().ask)));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
