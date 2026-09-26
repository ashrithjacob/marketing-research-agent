import type { Product, ProductCatalog, RunHead, StoredPacketRows } from "../../domain/index.js";

import type { PacketRowTable } from "./packet-row-table.js";
import type { ProductTable } from "./product-table.js";
import type { RunTable } from "./run-table.js";

export class SqliteProductCatalog implements ProductCatalog {
  constructor(
    private readonly table: ProductTable,
    private readonly runs: RunTable,
    private readonly rows: PacketRowTable,
  ) {}

  list(): Product[] {
    return this.table.list();
  }

  get(productId: string): Product | null {
    return this.table.get(productId);
  }

  byKey(key: string): Product | null {
    return this.table.byKey(key);
  }

  runHeads(): RunHead[] {
    return this.runs.heads();
  }

  packetRows(productId: string): StoredPacketRows {
    return this.rows.list(productId);
  }
}
