import { PacketError } from "./errors.js";

/** Finds candidate JSON in a model's prose: fenced blocks and balanced braces. */
export class JsonBlocks {
  static fenced(text: string): string[] {
    const blocks: string[] = [];
    let body: string[] | null = null;
    for (const line of text.split("\n")) {
      if (line.trimStart().startsWith("```")) {
        if (body === null) {
          body = [];
        } else {
          blocks.push(body.join("\n"));
          body = null;
        }
        continue;
      }
      if (body !== null) body.push(line);
    }
    if (body !== null) blocks.push(body.join("\n"));
    return blocks;
  }

  static balanced(text: string): string[] {
    const found: string[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (char === "}") {
        if (depth === 0) continue;
        depth--;
        if (depth === 0 && start !== -1) {
          found.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
    return found;
  }
}

/** Pulls the last decodable stage packet out of a run's output. */
export class PacketExtractor {
  extract(output: string): Record<string, unknown> {
    if (!output || !output.trim()) {
      throw new PacketError("run produced no output to read a packet from");
    }

    const candidates = JsonBlocks.fenced(output);
    const stripped = output.trim();
    if (stripped.startsWith("{")) candidates.push(stripped);
    candidates.push(...JsonBlocks.balanced(output));

    for (let i = candidates.length - 1; i >= 0; i--) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(candidates[i]!);
      } catch {
        continue;
      }
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded) && "stage" in decoded) {
        return decoded as Record<string, unknown>;
      }
    }

    if (candidates.length === 0) {
      throw new PacketError(
        "no fenced JSON block in the run output — the packet must be emitted as ```json … ```",
      );
    }
    throw new PacketError("found fenced blocks but none decoded to a stage packet object");
  }
}
