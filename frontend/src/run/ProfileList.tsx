import { useState } from 'react';

export default function ProfileList({ label, items, first = 3 }: { label: string; items: string[]; first?: number }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, first);
  return (
    <div className="profile-list">
      <h4>{label}</h4>
      <ul>
        {shown.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {items.length > first && (
        <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `+${items.length - first} more`}</button>
      )}
    </div>
  );
}
