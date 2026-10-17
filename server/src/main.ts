import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

import { serve } from "@hono/node-server";

import { PostgresDatabase, SqlResearchStore } from "./adapters/index.js";
import { Env } from "./config/index.js";
import { App } from "./http/index.js";
import { Trace, WireTap } from "./trace/index.js";

const CONNECT_MS_PER_ADDRESS_ON_A_SLOW_LINK_NOT_NODES_250 = 2500;
setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_MS_PER_ADDRESS_ON_A_SLOW_LINK_NOT_NODES_250);

const settings = Env.settings();
const traces = App.traceFile(settings);
Trace.install(traces);
new WireTap().attach();
traces.prune();
const store = await SqlResearchStore.open(PostgresDatabase.connect(settings.databaseUrl, settings.databaseConnections));
const app = new App({ settings, traces, store });
const recovered = await app.analyses.recover();
if (recovered > 0) console.log(`${recovered} run(s) were cut off by the restart and ended failed`);
app.prices.start();

const server = serve({ fetch: app.fetch, hostname: settings.host, port: settings.port }, (info) => {
  console.log(`marketing-research-agent listening on ${settings.host}:${info.port} (model ${settings.model})`);
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal}: stopping`);
    server.close();
    void app.close().then(
      () => process.exit(0),
      (error) => {
        console.error("shutdown failed", error);
        process.exit(1);
      },
    );
  });
}
