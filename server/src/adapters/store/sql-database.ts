export type SqlValue = string | number | boolean | null;
export type SqlRow = Record<string, any>;

/** One Postgres database, spoken with `?` for each parameter. */
export interface SqlDatabase {
  all<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  run(sql: string, params?: readonly SqlValue[]): Promise<number>;
  exec(script: string): Promise<void>;
  transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
