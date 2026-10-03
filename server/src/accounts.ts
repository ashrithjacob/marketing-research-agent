import { SqliteResearchStore } from "./adapters/index.js";
import { Env } from "./config/index.js";
import { AccountCommands, SecretPrompt } from "./http/index.js";

const store = new SqliteResearchStore(Env.settings().databasePath);
const code = await new AccountCommands(store.accounts, new SecretPrompt().ask, console.log).run(process.argv.slice(2));
await store.close();
process.exit(code);
