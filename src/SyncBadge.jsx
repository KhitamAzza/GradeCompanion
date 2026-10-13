import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Watches a single dummy doc. We don't care about its contents,
// only whether the snapshot came from cache and whether writes are pending.
export default function SyncBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [fromCache, setFromCache] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    const ref = doc(db, 'config', 'app');
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        setFromCache(snap.metadata.fromCache);
        setPending(snap.metadata.hasPendingWrites);
      },
      () => {}
    );
  }, []);

  let label = 'Synced';
  let color = 'bg-emerald-500';

  if (!online) {
    label = 'Offline'; color = 'bg-rose-500';
  } else if (pending) {
    label = 'Saving…'; color = 'bg-amber-500';
  } else if (fromCache) {
    label = 'Cached'; color = 'bg-slate-400';
  }

  return (
    // ...inside the return:
<span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
  <span className={`h-2 w-2 rounded-full ${color}`} />
  {label}
</span>
  );
}