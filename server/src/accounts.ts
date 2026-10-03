import { SqlResearchStore, StoreDatabase } from "./adapters/index.js";
import { Env } from "./config/index.js";
import { AccountCommands, SecretPrompt } from "./http/index.js";

const store = await SqlResearchStore.open(StoreDatabase.forSettings(Env.settings()));
const code = await new AccountCommands(store.accounts, new SecretPrompt().ask, console.log).run(process.argv.slice(2));
await store.close();
process.exit(code);
