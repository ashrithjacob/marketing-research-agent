const SECRET_NAME = /key|token|secret|password|authorization|cookie/i;
const MAX_TEXT = 120;
const MAX_KEYS = 6;
const MAX_FLAT = 4;

/** Renders one trace line: clock, elapsed, file, name, then key=value fields. */
export class TraceFormat {
  private static readonly files = new Map<string, string>();

  static file(fileUrl: string): string {
    const known = TraceFormat.files.get(fileUrl);
    if (known) return known;
    const path = decodeURIComponent(fileUrl.replace(/^file:\/\//, ""));
    const marker = Math.max(path.lastIndexOf("/src/"), path.lastIndexOf("/dist/"));
    const tail = marker >= 0 ? path.slice(path.indexOf("/", marker + 1) + 1) : path;
    const rel = tail.replace(/\.js$/, ".ts");
    TraceFormat.files.set(fileUrl, rel);
    return rel;
  }

  static line(
    now: number,
    startedAt: number,
    file: string,
    name: string,
    fields?: Record<string, unknown>,
  ): string {
    const clock = new Date(now).toISOString().slice(11, 23);
    const rendered = fields ? TraceFormat.fields(fields) : "";
    return `${clock} +${TraceFormat.elapsed(now - startedAt)} [${file}] ${name}${rendered ? ` ${rendered}` : ""}`;
  }

  static elapsed(ms: number): string {
    const total = Math.max(0, ms);
    const minutes = Math.floor(total / 60000);
    const seconds = ((total % 60000) / 1000).toFixed(3).padStart(6, "0");
    return `${String(minutes).padStart(2, "0")}:${seconds}`;
  }

  static fields(fields: Record<string, unknown>): string {
    return Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => `${name}=${SECRET_NAME.test(name) ? "***" : TraceFormat.value(value)}`)
      .join(" ");
  }

  static value(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "string") return TraceFormat.text(value);
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "function") return "fn";
    if (Array.isArray(value)) return `[${value.length}]`;
    if (value instanceof Error) return TraceFormat.text(value.message);
    if (typeof value === "object") return TraceFormat.shape(value as object);
    return typeof value;
  }

  static url(raw: string): string {
    try {
      const url = new URL(raw);
      for (const name of [...url.searchParams.keys()]) {
        if (SECRET_NAME.test(name)) url.searchParams.set(name, "***");
      }
      return TraceFormat.cut(`${url.host}${url.pathname}${url.search}`);
    } catch {
      return TraceFormat.cut(raw);
    }
  }

  private static text(value: string): string {
    const cut = TraceFormat.cut(value);
    return /[\s="]/.test(cut) || cut === "" ? JSON.stringify(cut) : cut;
  }

  private static cut(value: string): string {
    const flat = value.replace(/\s+/g, " ").trim();
    return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT)}…(${flat.length})` : flat;
  }

  private static isScalar(value: unknown): boolean {
    return value === null || ["string", "number", "boolean"].includes(typeof value);
  }

  private static shape(value: object): string {
    const kind = value.constructor?.name;
    if (kind && kind !== "Object") return kind;
    const entries = Object.entries(value);
    if (entries.length <= MAX_FLAT && entries.every(([, v]) => TraceFormat.isScalar(v))) {
      return TraceFormat.cut(`{${entries.map(([k, v]) => `${k}:${SECRET_NAME.test(k) ? "***" : String(v)}`).join(",")}}`);
    }
    const keys = Object.keys(value);
    const shown = keys.slice(0, MAX_KEYS).join(",");
    return `{${shown}${keys.length > MAX_KEYS ? `,+${keys.length - MAX_KEYS}` : ""}}`;
  }
}
