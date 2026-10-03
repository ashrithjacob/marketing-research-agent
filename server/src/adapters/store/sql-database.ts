export type SqlValue = string | number | null;
export type SqlRow = Record<string, any>;

/** One SQL engine, spoken in the subset SQLite and Postgres share, with `?` for each parameter. */
export interface SqlDatabase {
  all<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  run(sql: string, params?: readonly SqlValue[]): Promise<number>;
  exec(script: string): Promise<void>;
  columns(table: string): Promise<string[]>;
  transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
