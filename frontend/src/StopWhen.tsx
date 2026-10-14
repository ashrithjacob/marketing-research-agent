import { useEffect, useState } from 'react';

export default function StopWhen({ text, editable, onSave }: { text: string; editable: boolean; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);

  if (!editable) return text ? <div className="d stop-when">Stops and asks you when: {text}</div> : null;
  return (
    <label className="stop-when edit">
      <span>Stop and ask me when</span>
      <textarea
        rows={2}
        value={draft}
        placeholder="e.g. the site sells more than one product"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== text && onSave(draft.trim())}
      />
    </label>
  );
}
