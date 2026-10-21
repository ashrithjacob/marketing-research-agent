import { Trace } from "../../trace/index.js";

import type { ApifyApi } from "./apify-api.js";

interface InputSchema {
  properties?: Record<string, unknown>;
  required?: string[];
}

/** Checks an input against the actor's current input schema before it runs. Actors change their inputs without notice (the Reddit actor replaced `keywordsIncluded` with `query` on 2026-10-21), and an unknown field is ignored silently: the run is charged and returns nothing. */
export class ActorInputCheck {
  private readonly schemas = new Map<string, Promise<InputSchema>>();

  constructor(private readonly api: ApifyApi) {}

  async problems(actor: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<string[]> {
    Trace.line(import.meta.url, "ActorInputCheck.problems", { actor });
    const schema = await this.schema(actor, signal);
    const known = Object.keys(schema.properties ?? {});
    if (known.length === 0) return [];
    return [
      ...Object.keys(input).filter((field) => !known.includes(field)).map((field) => `${actor} no longer accepts \`${field}\``),
      ...(schema.required ?? []).filter((field) => !(field in input)).map((field) => `${actor} now requires \`${field}\``),
    ];
  }

  private schema(actor: string, signal?: AbortSignal): Promise<InputSchema> {
    Trace.line(import.meta.url, "ActorInputCheck.schema", { actor });
    const cached = this.schemas.get(actor);
    if (cached) return cached;
    const loaded = this.api
      .get<{ inputSchema?: string | InputSchema }>(`/acts/${actor.replace("/", "~")}/builds/default`, signal)
      .then((build) => (typeof build.inputSchema === "string" ? (JSON.parse(build.inputSchema) as InputSchema) : (build.inputSchema ?? {})));
    this.schemas.set(actor, loaded);
    void loaded.catch(() => this.schemas.delete(actor));
    return loaded;
  }
}
