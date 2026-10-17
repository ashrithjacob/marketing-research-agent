/** One piece of a fact's text: words to show, or a source the agent cited inline by its id. */
export type FactPiece = { text: string } | { source: string };

/** A recorded value as the cockpit shows it: a one-line preview, and the full text as items when the agent listed three or more separated by " | " (one bar is more likely part of a quote), with every source id the agent pasted in pulled out as a citation. */
export interface FactText {
  preview: string;
  items: FactPiece[][];
}

const HASH = /sha256:([0-9a-f]{6,64})\b|\b([0-9a-f]{40,64})\b/g;
const HASH_GROUP = /\(\s*(?:(?:sha256:[0-9a-f]{6,64}|[0-9a-f]{40,64})\s*[,;]?\s*)+\)/g;

function pieces(text: string): FactPiece[] {
  const out: FactPiece[] = [];
  let last = 0;
  const marked = text.replace(HASH_GROUP, (group) => group.replace(/[(),;]/g, ' '));
  for (const match of marked.matchAll(HASH)) {
    const before = marked.slice(last, match.index);
    if (before.trim()) out.push({ text: before.replace(/\s+/g, ' ') });
    out.push({ source: `sha256:${match[1] ?? match[2]}` });
    last = (match.index ?? 0) + match[0].length;
  }
  const rest = marked.slice(last);
  if (rest.trim()) out.push({ text: rest.replace(/\s+/g, ' ') });
  return out;
}

export function factText(value: unknown): FactText {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const parts = text.split(/\s+\|\s+/);
  const items = (parts.length >= 3 ? parts : [text]).map(pieces).filter((item) => item.length > 0);
  const preview = text.replace(HASH_GROUP, '').replace(HASH, '').replace(/\s+\|\s+/g, ' · ').replace(/\s+/g, ' ').trim();
  return { preview, items };
}

/** The source an id names: the exact id, or the one source whose id starts with a shortened one; undefined when it names none or several. */
export function findSource<T extends { id: string }>(sources: readonly T[], id: string): T | undefined {
  const exact = sources.find((s) => s.id === id);
  if (exact) return exact;
  const starting = sources.filter((s) => s.id.startsWith(id));
  return starting.length === 1 ? starting[0] : undefined;
}
