import type { ContentBlock, LlmCall, TraceMessage } from '../api';

export interface ToolAsk {
  id: string;
  name: string;
  args: unknown;
  index: number;
  of: number;
  seq: number;
}

export interface ToolAnswer {
  text: string;
  isError: boolean;
  seq: number;
}

export interface SentMessage {
  who: 'code' | 'model' | 'tool';
  label: string;
  preview: string;
}

/** Joins every tool call the model asked for to the result it got back, by tool-call id. */
export interface CallIndex {
  asks: Map<string, ToolAsk>;
  answers: Map<string, ToolAnswer>;
  bySeq: Map<number, LlmCall>;
}

export function indexCalls(calls: LlmCall[]): CallIndex {
  const asks = new Map<string, ToolAsk>();
  const answers = new Map<string, ToolAnswer>();
  const bySeq = new Map<number, LlmCall>();
  for (const call of calls) {
    bySeq.set(call.seq, call);
    const requested = askedOf(call);
    requested.forEach((block, index) => {
      if (block.id) {
        asks.set(block.id, {
          id: block.id,
          name: block.name ?? '',
          args: block.arguments,
          index: index + 1,
          of: requested.length,
          seq: call.seq,
        });
      }
    });
    for (const message of call.input) {
      if (message.role === 'toolResult' && message.toolCallId) {
        answers.set(message.toolCallId, {
          text: messageText(message),
          isError: !!message.isError,
          seq: call.seq,
        });
      }
    }
  }
  return { asks, answers, bySeq };
}

function blocks(call: LlmCall | undefined): ContentBlock[] {
  return call?.output?.content ?? [];
}

export function askedOf(call: LlmCall | undefined): ContentBlock[] {
  return blocks(call).filter((b) => b.type === 'toolCall');
}

export function thinkingOf(call: LlmCall | undefined): string {
  return blocks(call)
    .filter((b) => b.type === 'thinking')
    .map((b) => b.thinking ?? b.text ?? '')
    .join('\n');
}

export function saidOf(call: LlmCall | undefined): string {
  return blocks(call)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

export function messageText(message: TraceMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map((b) => b.text ?? b.thinking ?? (b.type === 'toolCall' ? `→ ${b.name}` : ''))
    .join('\n');
}

export function sentMessages(call: LlmCall): SentMessage[] {
  return call.input.map((message) => {
    const preview = messageText(message).slice(0, 160);
    if (message.role === 'toolResult') {
      return {
        who: 'tool',
        label: `result of ${message.toolName ?? 'a tool'}${message.isError ? ' (error)' : ''}`,
        preview,
      };
    }
    if (message.role === 'assistant') {
      return {
        who: 'model',
        label: droppedBeforeSending(message)
          ? 'its failed answer — dropped by pi-ai, not sent to the model'
          : 'its own previous answer',
        preview,
      };
    }
    return {
      who: 'code',
      label: call.seq === 1 ? 'the instructions (PromptBuilder)' : 'a message injected by the code',
      preview,
    };
  });
}

/** pi-ai leaves errored and aborted answers out of what it sends, so the model never sees them again. */
export function droppedBeforeSending(message: TraceMessage): boolean {
  return message.role === 'assistant' && (message.stopReason === 'error' || message.stopReason === 'aborted');
}

export function sentCount(call: LlmCall): number {
  return call.input.filter((m) => !droppedBeforeSending(m)).length;
}

export function stopMeaning(call: LlmCall | undefined): string {
  if (!call) return 'still answering';
  if (call.error) return `failed: ${call.error}`;
  const asked = askedOf(call).length;
  if (call.stop_reason === 'toolUse') {
    return `stop reason toolUse → the code ran ${asked} tool${asked === 1 ? '' : 's'}`;
  }
  if (call.stop_reason === 'stop') return 'stop reason stop → the model finished; the run settles';
  return `stop reason ${call.stop_reason || 'unknown'}`;
}

export function firstLine(text: string, limit = 180): string {
  const line = text.trim().split('\n').find((l) => l.trim()) ?? '';
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

/** What the model did in the call that received a tool's result: its first thought and what it asked for. */
export function reactionIn(index: CallIndex, seq: number): { seq: number; thought: string; asked: string[] } | null {
  const call = index.bySeq.get(seq);
  if (!call) return null;
  return {
    seq,
    thought: firstLine(thinkingOf(call) || saidOf(call)),
    asked: askedOf(call).map((b) => b.name ?? ''),
  };
}
