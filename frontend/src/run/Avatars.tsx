import { useEffect, useState } from 'react';

import { runs, type AvatarQuote, type ReadAd, type StoredAvatar } from '../api';
import AdAvatars from './AdAvatars';
import AvatarDetail from './AvatarDetail';
import AvatarGaps from './AvatarGaps';
import AvatarOverview from './AvatarOverview';
import type { BarOf } from './StageBar';

type Tab = 'reviews' | 'ads' | 'gaps';

export default function Avatars({ runId, version, ads, bar, onError }: { runId: string; version: string; ads: ReadAd[]; bar: BarOf; onError: (message: string) => void }) {
  const [avatars, setAvatars] = useState<StoredAvatar[]>([]);
  const [quotes, setQuotes] = useState<AvatarQuote[]>([]);
  const [tab, setTab] = useState<Tab>('reviews');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (version !== 'completed') return;
    runs.avatars(runId).then((r) => {
      setAvatars(r.avatars);
      setQuotes(r.quotes);
    }, (e: Error) => onError(e.message));
  }, [runId, version, onError]);

  if (avatars.length === 0) return bar([]);
  const fromReviews = avatars.filter((a) => a.source !== 'ads');
  const fromAds = avatars.filter((a) => a.source === 'ads');
  const tops = fromReviews.filter((a) => a.parent_id === null);
  const subs = fromReviews.length - tops.length;
  const subsOf = (id: string) => fromReviews.filter((a) => a.parent_id === id).sort((a, b) => b.review_count - a.review_count);
  const opened = fromReviews.find((a) => a.id === open) ?? null;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'reviews', label: `From reviews (${tops.length})` },
    { key: 'ads', label: `From ads (${fromAds.length})` },
    { key: 'gaps', label: 'Gaps' },
  ];
  return (
    <>
      {bar([
        { label: 'avatars from reviews', value: `${tops.length}${subs ? ` + ${subs} sub` : ''}`, target: 'avatar-tabs' },
        { label: 'avatars from ads', value: fromAds.length, target: 'avatar-tabs' },
        { label: 'gap themes', value: tops.reduce((n, a) => n + (a.profile.gaps?.length ?? 0), 0), target: 'avatar-tabs' },
      ])}
      <div className="tabs" id="avatar-tabs" role="tablist" aria-label="Avatars">
        {tabs.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`panel-${t.key}`} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'reviews' && !opened && <AvatarOverview tops={tops} subsOf={subsOf} onOpen={setOpen} />}
        {tab === 'reviews' && opened && (
          <AvatarDetail
            avatar={opened}
            parent={fromReviews.find((a) => a.id === opened.parent_id) ?? null}
            subs={subsOf(opened.id)}
            quotes={quotes.filter((q) => q.avatar_id === opened.id)}
            onOpen={setOpen}
            onBack={() => setOpen(null)}
          />
        )}
        {tab === 'ads' && <AdAvatars avatars={fromAds} ads={ads} buyers={tops} />}
        {tab === 'gaps' && <AvatarGaps avatars={fromReviews} quotes={quotes} />}
      </div>
    </>
  );
}
