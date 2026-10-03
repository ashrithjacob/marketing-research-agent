import { Scope, type Product, type ProductCatalog, type RunHead, type StoredPacketRows } from "../../domain/index.js";

import type { PacketRowTable } from "./packet-row-table.js";
import type { ProductTable } from "./product-table.js";
import type { RunTable } from "./run-table.js";
import { Trace } from "../../trace/index.js";

export class SqlProductCatalog implements ProductCatalog {
  constructor(
    private readonly table: ProductTable,
    private readonly runs: RunTable,
    private readonly rows: PacketRowTable,
  ) {}

  async list(scope: Scope): Promise<Product[]> {
    Trace.line(import.meta.url, "SqlProductCatalog.list", { scope });
    return this.table.list(scope);
  }

  async get(productId: string, scope: Scope): Promise<Product | null> {
    Trace.line(import.meta.url, "SqlProductCatalog.get", { productId, scope });
    return this.table.get(productId, scope);
  }

  async byKey(key: string): Promise<Product | null> {
    Trace.line(import.meta.url, "SqlProductCatalog.byKey", { key });
    return this.table.byKey(key, Scope.everything);
  }

  async runHeads(scope: Scope): Promise<RunHead[]> {
    Trace.line(import.meta.url, "SqlProductCatalog.runHeads", { scope });
    return this.runs.heads(scope);
  }

  async packetRows(productId: string, scope: Scope): Promise<StoredPacketRows> {
    Trace.line(import.meta.url, "SqlProductCatalog.packetRows", { productId, scope });
    return this.rows.list(productId, scope);
  }
}
