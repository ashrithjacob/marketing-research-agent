import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

import { serve } from "@hono/node-server";

import { SqlResearchStore, StoreDatabase } from "./adapters/index.js";
import { PiHarness, RunSupervisor } from "./agent/index.js";
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
const store = await SqlResearchStore.open(StoreDatabase.forSettings(settings));
const models = RunSupervisor.defaultModels();
const harness = await PiHarness.open(settings.harnessPath, models, [settings.model, ...settings.backupModels]);
const app = new App({ settings, traces, store, harness });

await app.supervisor.recoverRunsKilledByRestart();
const abandoned = await app.intake.recover();
if (abandoned > 0) console.log(`${abandoned} document conversion(s) were cut off by the restart and marked failed`);
const resettled = await app.supervisor.resettleInvalidRuns();
if (resettled.length > 0) console.log(`re-settled ${resettled.length} invalid run(s) from their ledgers: ${resettled.join(", ")}`);
const picked = app.workspace ? await app.workspace.tasks.recover() : 0;
const released = app.workspace ? await app.workspace.release.recover() : 0;
if (released > 0) console.log(`started ${released} plan task(s) whose wait ended while the server was down`);
if (app.workspace) await app.workspace.stages.recover();
harness.resume();
app.workspace?.reviewer.start();
const alwaysOn = app.workspace ? await app.workspace.alwaysOn.recover() : 0;
if (alwaysOn > 0) console.log(`Always on for ${alwaysOn} workspace(s): their schedule watchers are running`);
console.log(`harness ${harness.reopened ? "reopened" : "created"} at ${harness.path}; ${picked} task(s) to pick back up`);
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
    app.workspace?.reviewer.stop();
    void harness
      .close()
      .then(() => app.close())
      .then(
        () => process.exit(0),
        (error) => {
          console.error("shutdown failed", error);
          process.exit(1);
        },
      );
  });
}
