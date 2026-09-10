import { useEffect, useRef, useState } from 'react';
import { freshPhotoSession, parsePhotoSession, PHOTO_KEY } from './photo-session';
import { PHOTOS } from './photo-catalog';
import type { PhotoSession } from './photo-types';

type Problem = 'invalid' | 'unavailable' | 'conflict' | 'clear-failed' | null;
type Loaded = { session: PhotoSession; raw: string | null; problem: Problem };
function load(): Loaded {
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    const result = parsePhotoSession(raw, PHOTOS);
    return { session: result.session, raw, problem: result.status === 'invalid' ? 'invalid' : null };
  } catch { return { session: freshPhotoSession(), raw: null, problem: 'unavailable' }; }
}
export function usePhotoStudy() {
  const [initial] = useState(load);
  const [session, updateSession] = useState(initial.session);
  const [problem, updateProblem] = useState<Problem>(initial.problem);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearingRef = useRef(false);
  const state = useRef(initial.session);
  const expected = useRef(initial.raw);
  const blocked = useRef<Problem>(initial.problem);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const pending = useRef(0);
  function setProblem(value: Problem) {
    if (value === 'unavailable' && ['invalid', 'conflict', 'clear-failed'].includes(blocked.current || '')) return;
    blocked.current = value; updateProblem(value);
  }
  useEffect(() => {
    function inspect() {
      if (clearingRef.current) return;
      try { if (localStorage.getItem(PHOTO_KEY) !== expected.current) setProblem('conflict'); }
      catch { setProblem('unavailable'); }
    }
    function changed(event: StorageEvent) {
      if (event.key !== PHOTO_KEY && event.key !== null) return;
      try { if (event.storageArea === localStorage) inspect(); }
      catch { setProblem('unavailable'); }
    }
    const visible = () => { if (document.visibilityState === 'visible') inspect(); };
    window.addEventListener('storage', changed);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('storage', changed); document.removeEventListener('visibilitychange', visible); };
  }, []);
  function setSession(change: PhotoSession | ((previous: PhotoSession) => PhotoSession)) {
    if (clearingRef.current) return;
    const next = typeof change === 'function' ? change(state.current) : change;
    if (next === state.current) return;
    state.current = next;
    updateSession(next);
    if (blocked.current === 'invalid' || blocked.current === 'conflict' || blocked.current === 'clear-failed') return;
    if (!navigator.locks) { setProblem('unavailable'); return; }
    const epoch = generation.current;
    pending.current++;
    setSaving(true);
    queue.current = queue.current.then(async () => {
      await navigator.locks.request(PHOTO_KEY, () => {
        if (epoch !== generation.current || blocked.current === 'invalid' || blocked.current === 'conflict' || blocked.current === 'clear-failed') return;
        if (localStorage.getItem(PHOTO_KEY) !== expected.current) { setProblem('conflict'); return; }
        const raw = JSON.stringify(next);
        localStorage.setItem(PHOTO_KEY, raw);
        if (localStorage.getItem(PHOTO_KEY) !== raw) throw new Error('Save verification failed');
        expected.current = raw;
        setProblem(null);
      });
    }).catch(() => { setProblem('unavailable'); }).finally(() => {
      pending.current--;
      setSaving(pending.current > 0);
    });
  }
  function reloadSaved(): boolean {
    if (clearingRef.current) return false;
    const loaded = load();
    if (loaded.problem) { setProblem(loaded.problem); return false; }
    if (loaded.raw === null) { setProblem('conflict'); return false; }
    generation.current++;
    state.current = loaded.session;
    expected.current = loaded.raw;
    updateSession(loaded.session);
    setProblem(null);
    return true;
  }
  async function reset(): Promise<boolean> {
    if (clearingRef.current) return false;
    if (!navigator.locks) { setProblem('clear-failed'); return false; }
    let confirmedRaw: string | null;
    try { confirmedRaw = localStorage.getItem(PHOTO_KEY); }
    catch { setProblem('clear-failed'); return false; }
    clearingRef.current = true;
    setClearing(true);
    generation.current++;
    await queue.current;
    try {
      const clear = () => {
        if (localStorage.getItem(PHOTO_KEY) !== confirmedRaw) throw new Error('Saved study changed while clearing');
        localStorage.removeItem(PHOTO_KEY);
        if (localStorage.getItem(PHOTO_KEY) !== null) throw new Error('Clear verification failed');
        generation.current++;
        expected.current = null;
        const next = freshPhotoSession();
        state.current = next;
        updateSession(next);
        setProblem(null);
      };
      if (navigator.locks) await navigator.locks.request(PHOTO_KEY, clear);
      else clear();
      return true;
    } catch { setProblem('clear-failed'); return false; }
    finally { clearingRef.current = false; setClearing(false); }
  }
  return { session, setSession, problem, saving, clearing, reloadSaved, reset };
}
