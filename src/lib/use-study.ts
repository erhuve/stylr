import { useEffect, useRef, useState } from 'react';
import { freshSession, parseSession, STORAGE_KEY } from './style-engine';
import type { Session } from './style-types';

type Problem = 'invalid' | 'unavailable' | 'conflict' | 'clear-failed' | null;
type Loaded = { session: Session; raw: string | null; problem: Problem };
function load(): Loaded {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const result = parseSession(raw);
    return { session: result.session, raw, problem: result.status === 'invalid' ? 'invalid' : null };
  } catch {
    return { session: freshSession(), raw: null, problem: 'unavailable' };
  }
}

export function useStudy() {
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
  function setProblem(value: Problem) { blocked.current = value; updateProblem(value); }

  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== localStorage) return;
        if (localStorage.getItem(STORAGE_KEY) !== expected.current) setProblem('conflict');
      } catch { setProblem('unavailable'); }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  function setSession(change: Session | ((previous: Session) => Session)) {
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
      await navigator.locks.request(STORAGE_KEY, () => {
        if (epoch !== generation.current || blocked.current === 'invalid' || blocked.current === 'conflict' || blocked.current === 'clear-failed') return;
        if (localStorage.getItem(STORAGE_KEY) !== expected.current) { setProblem('conflict'); return; }
        const raw = JSON.stringify(next);
        localStorage.setItem(STORAGE_KEY, raw);
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
    generation.current++;
    state.current = loaded.session;
    expected.current = loaded.raw;
    updateSession(loaded.session);
    setProblem(null);
    return true;
  }

  async function reset(): Promise<boolean> {
    if (clearingRef.current) return false;
    clearingRef.current = true;
    setClearing(true);
    generation.current++;
    await queue.current;
    try {
      const clear = () => {
        localStorage.removeItem(STORAGE_KEY);
        generation.current++;
        expected.current = null;
        const next = freshSession();
        state.current = next;
        updateSession(next);
        setProblem(null);
      };
      if (navigator.locks) await navigator.locks.request(STORAGE_KEY, clear);
      else clear();
      return true;
    } catch {
      setProblem('clear-failed');
      return false;
    } finally {
      clearingRef.current = false;
      setClearing(false);
    }
  }
  return { session, setSession, problem, saving, clearing, reloadSaved, reset };
}
