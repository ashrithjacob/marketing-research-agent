import { useState } from 'react';

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function BrandMark({ name, src, size = 36, shape = 'round' }: { name: string; src: string | null; size?: number; shape?: 'round' | 'square' }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size / 2.8)) };
  if (!src || broken) {
    return (
      <span className={`brand-mark fallback ${shape}`} style={style} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return <img className={`brand-mark ${shape}`} style={style} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}
