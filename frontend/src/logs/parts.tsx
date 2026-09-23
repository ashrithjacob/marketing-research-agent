import { useState } from 'react';
import type { ContentBlock, LlmCall, TraceMessage } from '../api';

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function ToolsList({ tools }: { tools: LlmCall['tools'] }) {
  if (!tools) return null;
  return (
    <Collapsible title={`Tools offered (${tools.length}): ${tools.map((t) => t.name).join(', ')}`}>
      {tools.map((tool) => (
        <div key={tool.name} className="tool-def">
          <b>{tool.name}</b> — {tool.description}
          <Clip text={JSON.stringify(tool.parameters, null, 2)} mono />
        </div>
      ))}
    </Collapsible>
  );
}

export function MessageView({ message }: { message: TraceMessage }) {
  const label =
    message.role === 'toolResult'
      ? `tool result · ${message.toolName ?? ''}${message.isError ? ' · error' : ''}`
      : message.role === 'assistant'
        ? 'assistant · its previous answer'
        : message.role;
  const blocks: ContentBlock[] =
    typeof message.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : message.content;
  return (
    <div className={`msg ${message.role} ${message.isError ? 'error' : ''}`}>
      <div className="msg-role">{label}</div>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

export function BlockView({ block }: { block: ContentBlock }) {
  if (block.type === 'thinking') {
    return (
      <Collapsible title="thinking" className="thinking">
        <Clip text={block.thinking ?? block.text ?? ''} />
      </Collapsible>
    );
  }
  if (block.type === 'toolCall') {
    return (
      <div className="toolcall">
        <span className="toolcall-name">→ {block.name}</span>
        <Clip text={JSON.stringify(block.arguments ?? {}, null, 2)} mono />
      </div>
    );
  }
  if (block.type === 'text') return <Clip text={block.text ?? ''} />;
  return <p className="muted small">[{block.type}]</p>;
}

export function Collapsible({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`sub ${className ?? ''}`}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function Clip({ text, mono }: { text: string; mono?: boolean }) {
  const LIMIT = 4000;
  const [all, setAll] = useState(false);
  const long = text.length > LIMIT;
  return (
    <div className={`clip ${mono ? 'mono' : ''}`}>
      <pre>{all || !long ? text : `${text.slice(0, LIMIT)}…`}</pre>
      {long && (
        <button className="ghost small-btn" onClick={() => setAll((a) => !a)}>
          {all ? 'Show less' : `Show all ${text.length.toLocaleString()} characters`}
        </button>
      )}
    </div>
  );
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
