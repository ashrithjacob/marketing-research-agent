import { serve } from "@hono/node-server";

import { createApp } from "./app.js";

const app = createApp();

app.supervisor.recoverRunsKilledByRestart();
app.supervisor.costs.start();

const server = serve(
  { fetch: app.fetch, hostname: app.settings.host, port: app.settings.port },
  (info) => {
    console.log(
      `marketing-research-agent listening on ${app.settings.host}:${info.port} ` +
        `(model ${app.settings.model})` +
        (app.settings.apifyToken ? "" : " — review mining disabled, APIFY_TOKEN is not set"),
    );
  },
);

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} — stopping`);
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
