import { Trace } from "../trace/index.js";

/** An ad's hook is the opening of its copy, cut by code so no model re-types it: the first sentence or the first line, whichever is shorter, at most 200 characters. */
export class HookCutter {
  static readonly MAX_CHARS = 200;

  static cut(copy: string): string {
    Trace.tick(import.meta.url, "HookCutter.cut");
    const text = copy.trim();
    const line = text.split(/\r?\n/)[0]!.trim();
    const sentence = /^.*?[.!?](?=\s|$)/s.exec(text)?.[0].trim() ?? text;
    const shorter = sentence.length < line.length ? sentence : line;
    return shorter.slice(0, HookCutter.MAX_CHARS).trim();
  }
}
