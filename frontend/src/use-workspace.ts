import { useEffect, useState } from 'react';

import { streamWorkspace, type Board, type ChatMessage } from './api';

export function useWorkspace(): { chat: ChatMessage[]; board: Board | null; connected: boolean } {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => streamWorkspace(setChat, setBoard, setConnected), []);
  return { chat, board, connected };
}
