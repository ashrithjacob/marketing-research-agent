import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

import { PostgresDatabase, SqlResearchStore } from "../src/adapters/index.js";

/** The research store on an in-process Postgres, reached through the same `pg` driver production uses. One connection: PGlite runs one session. */
export class PostgresStores {
  private constructor(
    private readonly db: PGlite,
    private readonly server: PGLiteSocketServer,
    readonly store: SqlResearchStore,
  ) {}

  static async start(): Promise<PostgresStores> {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
    await server.start();
    const { port } = (server as unknown as { server: { address(): { port: number } } }).server.address();
    const store = await SqlResearchStore.open(PostgresDatabase.connect(`postgres://postgres@127.0.0.1:${port}/postgres`, 1));
    return new PostgresStores(db, server, store);
  }

  async stop(): Promise<void> {
    await this.store.close();
    await this.server.stop();
    await this.db.close();
  }
}
