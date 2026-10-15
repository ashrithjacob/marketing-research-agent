import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

const plainLink = ({ children }: { children?: ReactNode }) => <span className="chat-link">{children}</span>;

export default function ChatText({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <Markdown components={{ a: plainLink, img: () => null }}>{text}</Markdown>
    </div>
  );
}
