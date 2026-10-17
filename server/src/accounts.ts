import { PostgresDatabase, SqlResearchStore } from "./adapters/index.js";
import { Env } from "./config/index.js";
import { AccountCommands, SecretPrompt } from "./http/index.js";

const settings = Env.settings();
const store = await SqlResearchStore.open(PostgresDatabase.connect(settings.databaseUrl, 1));
const code = await new AccountCommands(store.accounts, new SecretPrompt().ask, console.log).run(process.argv.slice(2));
await store.close();
process.exit(code);
