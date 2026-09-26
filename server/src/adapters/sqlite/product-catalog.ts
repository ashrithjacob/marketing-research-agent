import { Scope, type Product, type ProductCatalog, type RunHead, type StoredPacketRows } from "../../domain/index.js";

import type { PacketRowTable } from "./packet-row-table.js";
import type { ProductTable } from "./product-table.js";
import type { RunTable } from "./run-table.js";
import { Trace } from "../../trace/index.js";

export class SqliteProductCatalog implements ProductCatalog {
  constructor(
    private readonly table: ProductTable,
    private readonly runs: RunTable,
    private readonly rows: PacketRowTable,
  ) {}

  list(scope: Scope): Product[] {
    Trace.line(import.meta.url, "SqliteProductCatalog.list", { scope });
    return this.table.list(scope);
  }

  get(productId: string, scope: Scope): Product | null {
    Trace.line(import.meta.url, "SqliteProductCatalog.get", { productId, scope });
    return this.table.get(productId, scope);
  }

  byKey(key: string): Product | null {
    Trace.line(import.meta.url, "SqliteProductCatalog.byKey", { key });
    return this.table.byKey(key, Scope.everything);
  }

  runHeads(scope: Scope): RunHead[] {
    Trace.line(import.meta.url, "SqliteProductCatalog.runHeads", { scope });
    return this.runs.heads(scope);
  }

  packetRows(productId: string, scope: Scope): StoredPacketRows {
    Trace.line(import.meta.url, "SqliteProductCatalog.packetRows", { productId, scope });
    return this.rows.list(productId, scope);
  }
}
