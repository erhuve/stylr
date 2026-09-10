import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, Download, ExternalLink, Heart, HelpCircle, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import FashionModel from '../components/FashionModel';
import { DIRECTIONS, LOOKS, TRAITS } from '../lib/looks';
import { recordVote, CONSTRAINT_LABELS, DEFAULT_BODY, nextLook, notesMarkdown, portrait, recommendations, shoppingUrl, SKINS, undoSession } from '../lib/style-engine';
import { useStudy } from '../lib/use-study';
import type { Body, Constraint, Draft, Reaction, Session, Trait } from '../lib/style-types';
import '../study.css';

const PROPORTIONS = [
  { key: 'shoulders', label: 'Shoulders', ends: ['Narrower', 'Broader'] },
  { key: 'chest', label: 'Chest', ends: ['Less volume', 'More volume'] },
  { key: 'waist', label: 'Waist', ends: ['Narrower', 'Fuller'] },
  { key: 'hips', label: 'Hips', ends: ['Narrower', 'Fuller'] },
  { key: 'torso', label: 'Torso / legs', ends: ['Longer legs', 'Longer torso'] },
] as const;
const STARTS = [
  { shoulders: 30, chest: 30, waist: 30, hips: 30, torso: 50 },
  { shoulders: 35, chest: 60, waist: 30, hips: 70, torso: 50 },
  { shoulders: 80, chest: 55, waist: 45, hips: 35, torso: 50 },
  { shoulders: 65, chest: 80, waist: 80, hips: 80, torso: 50 },
];
const WORDS: Record<Reaction, string> = { wear: 'I’d wear it', admire: 'Love it, not for me', pass: 'Not my thing', unsure: 'Not sure yet' };
const TRAIT_KEYS = Object.keys(TRAITS) as Trait[];

export default function StyleStudy() {
  const { session, setSession, problem, saving, clearing, reloadSaved, reset } = useStudy();
  const [drag, setDrag] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [dialog, setDialog] = useState<'about' | 'reset' | 'reload' | 'undo' | null>(null);
  const [reacting, setReacting] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(session.step);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; lookId: string } | null>(null);
  const current = nextLook(session.votes, session.draft?.lookId);
  const draft: Draft = session.draft?.lookId === current?.id ? session.draft! : { lookId: current?.id ?? '', note: '', more: [], less: [] };
  const p = portrait(session.votes);
  const allDone = session.votes.length === LOOKS.length;
  const suggested = recommendations(session.votes, session.exclusions);

  useEffect(() => {
    if (previousStep.current !== session.step) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      heading.current?.focus({ preventScroll: true });
      previousStep.current = session.step;
    }
  }, [session.step]);
  useEffect(() => {
    if (dialog) modal.current?.showModal(); else modal.current?.close();
  }, [dialog]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function cast(reaction: Reaction) {
    if (!current || session.step !== 'discover' || dialog || lock.current) return;
    lock.current = true;
    setReacting(true);
    const updated = recordVote(session, current.id, reaction);
    setSession(updated);
    const next = nextLook(updated.votes, updated.draft?.lookId);
    setAnnouncement(`Reaction recorded: ${WORDS[reaction]} for ${current.name}. ${updated.votes.length} of ${LOOKS.length} explored. ${next ? `Next: ${next.name}. ${next.pieces.join(', ')}.` : 'Your portrait is ready.'}`);
    setDrag(0);
    pointer.current = null;
    timer.current = setTimeout(() => { lock.current = false; setReacting(false); }, 350);
  }
  function undo() {
    if (lock.current || !session.votes.length) return;
    if (session.draft && (session.draft.note.trim() || session.draft.more.length || session.draft.less.length)) { setDialog('undo'); return; }
    performUndo();
  }
  function performUndo() {
    if (lock.current) return;
    lock.current = true;
    setReacting(true);
    timer.current = setTimeout(() => { lock.current = false; setReacting(false); }, 350);
    const updated = undoSession(session);
    setSession(updated);
    const next = nextLook(updated.votes, updated.draft?.lookId);
    setAnnouncement(`Last reaction undone. ${next ? `${next.name}: ${next.pieces.join(', ')}. Previous feedback restored.` : ''}`);
    setDrag(0);
    pointer.current = null;
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const el = event.target as HTMLElement;
      if (session.step !== 'discover' || dialog || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || el.closest('input,textarea,select,button,a,summary,[contenteditable]')) return;
      const keys: Record<string, Reaction> = { ArrowLeft: 'pass', ArrowRight: 'wear', ArrowDown: 'unsure' };
      if (keys[event.key]) { event.preventDefault(); cast(keys[event.key]); }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  function changeDraft(change: Partial<Draft>) {
    if (!current) return;
    setSession(s => ({ ...s, draft: { ...draft, ...change, lookId: current.id } }));
  }
  function toggleTrait(trait: Trait, kind: 'more' | 'less') {
    const other = kind === 'more' ? 'less' : 'more';
    changeDraft({ [kind]: draft[kind].includes(trait) ? draft[kind].filter(t => t !== trait) : [...draft[kind], trait], [other]: draft[other].filter(t => t !== trait) });
  }
  function download(raw = false) {
    const content = raw ? JSON.stringify(session, null, 2) : notesMarkdown(session);
    const url = URL.createObjectURL(new Blob([content], { type: raw ? 'application/json' : 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = raw ? 'stylr-session.json' : 'my-stylr-notes.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAnnouncement('Download started.');
  }
  function changeBody(update: Partial<Body>) { setSession(s => ({ ...s, body: { ...s.body, ...update } })); }
  function navigate(step: Session['step']) {
    setSession(s => ({ ...s, step }));
    setDrag(0);
    pointer.current = null;
  }
  function goDiscover() { navigate(allDone ? 'portrait' : 'discover'); }

  return <div className="study-shell" onKeyDownCapture={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ') && (event.target as HTMLElement).closest('.reaction,.admire-button,.undo-button,.revisit-button')) event.preventDefault(); }}>
    <a href="#study-main" className="skip-link">Skip to the study</a>
    <header className="site-header">
      <div className="wordmark" aria-label="Stylr">stylr<span aria-hidden="true">✳</span></div>
      <nav aria-label="Study steps" className="step-nav">
        {(['model', 'discover', 'portrait'] as const).map((step, index) => <button key={step} aria-current={session.step === step ? 'step' : undefined} disabled={(step === 'portrait' && session.votes.length < 6) || (step === 'discover' && allDone)} onClick={() => navigate(step)}><span>{String(index + 1).padStart(2, '0')}</span>{['Your figure', 'Explore', 'Your portrait'][index]}</button>)}
      </nav>
      <button className="about-button" onClick={() => setDialog('about')}><span>THE STUDY</span><HelpCircle size={16} /></button>
    </header>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {problem && <div className="storage-alert" role="alert">
      <p>{problem === 'clear-failed' ? 'Could not clear the saved study. Your data is still stored in this browser. Retry Clear my study, or clear this site’s data in your browser settings.' : problem === 'invalid' ? 'Saved data could not be read. It has not been overwritten. You can explore without saving, or clear the old study to start fresh.' : problem === 'conflict' ? 'Another tab changed this study. Saving is paused so neither version is silently overwritten. Download this tab’s notes before loading the saved version.' : 'This browser could not save your study. You can keep exploring, but changes may be lost on reload. Download your notes to keep a copy.'}</p>
      <button onClick={() => download()}>Download this tab’s notes</button>
      {problem === 'conflict' && <button onClick={() => setDialog('reload')}>Load saved version</button>}
      {problem === 'invalid' && <button onClick={() => setDialog('reset')}>Clear unreadable study</button>}
    </div>}

    {session.step === 'model' && <main id="study-main" className="model-page page-enter">
      <section className="model-controls">
        <p className="eyebrow"><span className="tiny-star" aria-hidden="true">✳</span> A STUDY IN PERSONAL STYLE</p>
        <h1 ref={heading} tabIndex={-1}>Good style starts<br />with <em>you.</em></h1>
        <p className="intro-copy">Make this figure feel a little like you.<br className="desktop-break" /> Then discover what catches your eye—without dressing by someone else’s rules.</p>
        <div className="control-heading"><h2>A starting point</h2><span>No measurements needed</span></div>
        <div className="body-presets" role="group" aria-label="Starting proportions">
          {STARTS.map((start, i) => <button key={i} aria-label={`Starting figure ${i + 1}`} aria-pressed={Object.entries(start).every(([k, v]) => session.body[k as keyof Body] === v)} onClick={() => changeBody(start)}><span aria-hidden="true"><FashionModel body={{ ...session.body, ...start }} look={LOOKS[0]!} neutral /></span><span>0{i + 1}</span></button>)}
        </div>
        <div className="control-heading refine-heading"><h2>Make it yours</h2><button className="text-button" onClick={() => changeBody({ ...DEFAULT_BODY, skin: session.body.skin, hair: session.body.hair })}>Reset proportions</button></div>
        <div className="sliders">
          {PROPORTIONS.map(({ key, label, ends }) => <div className="slider-row" key={key}><label htmlFor={`body-${key}`}>{label}</label><div className="slider-track"><input id={`body-${key}`} type="range" min="0" max="100" value={session.body[key]} aria-valuetext={`${session.body[key]} of 100; ${ends[0]} to ${ends[1]}`} onChange={e => changeBody({ [key]: Number(e.target.value) })} /><div className="range-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div></div></div>)}
        </div>
        <div className="appearance-row"><span className="control-label">Skin tone</span><div className="skin-tones" role="group" aria-label="Skin tone">{SKINS.map((skin, i) => <button key={skin} aria-label={`Skin tone ${i + 1}`} aria-pressed={session.body.skin === skin} style={{ background: skin }} onClick={() => changeBody({ skin })}>{session.body.skin === skin && <Check size={14} color={i > 2 ? '#fff' : '#33271f'} />}</button>)}</div></div>
        <div className="appearance-row"><span className="control-label">Hair</span><div className="hair-options" role="group" aria-label="Hair length">{(['crop', 'bob', 'long'] as const).map(hair => <button key={hair} aria-pressed={session.body.hair === hair} onClick={() => changeBody({ hair })}>{hair === 'crop' ? 'Short' : hair === 'bob' ? 'Bob' : 'Long'}</button>)}</div></div>
        <button className="primary-button start-button" onClick={goDiscover}>{session.votes.length ? allDone ? 'Back to your portrait' : 'Continue exploring' : 'Find what feels like you'}<ArrowRight size={18} /></button>
        <p className="under-button">24 looks · early portrait after 6 · no right answers</p>
      </section>
      <section className="model-preview" aria-label="Your figure preview">
        <div className="figure-stage"><div className="stage-top"><span>YOUR STARTING SILHOUETTE</span><span>FIG. 01</span></div><div className="measurement-rule rule-left" /><div className="measurement-rule rule-right" /><FashionModel body={session.body} look={LOOKS[0]!} neutral className="main-figure" /><div className="stage-bottom"><span className="live-dot" />Proportions follow you</div><div className="handwritten" aria-hidden="true">a little more you ↙</div></div>
        <div className="preview-strip"><div className="strip-caption"><span>SAME YOU.</span><span>NEW POSSIBILITIES.</span><ArrowRight size={18} /></div>{[LOOKS[0]!, LOOKS[2]!, LOOKS[3]!].map(look => <div key={look.id} style={{ background: look.background }}><FashionModel body={session.body} look={look} /></div>)}</div>
        <p className="prototype-note">Illustrated proportions, not a fit prediction.<br />Your figure never limits the styles you see.</p>
      </section>
    </main>}

    {session.step === 'discover' && current && <main id="study-main" className="discover-page page-enter">
      <div className="discovery-heading"><div><p className="eyebrow">FOLLOW YOUR EYE</p><h1 ref={heading} tabIndex={-1}>Could this be <em>you?</em></h1><p>Go with your first feeling. We’ll find the threads.</p></div><button className="outline-button" onClick={() => navigate('model')}><SlidersHorizontal size={15} />Adjust figure</button></div>
      <div className="quiz-layout">
        <aside className="quiz-aside" aria-label="Your exploration"><p className="eyebrow">YOUR EXPLORATION</p><div className="count"><strong>{String(session.votes.length + 1).padStart(2, '0')}</strong><span>/ {LOOKS.length}</span></div><div className="progress-track" role="progressbar" aria-label="Looks explored" aria-valuenow={session.votes.length} aria-valuemin={0} aria-valuemax={LOOKS.length}><span style={{ width: `${session.votes.length / LOOKS.length * 100}%` }} /></div><p>{session.votes.length < 6 || session.votes.length % 3 === 0 ? 'A little of everything. Leave room to be surprised.' : 'Following your reactions, with a few new directions.'}</p><div className="saved-tally"><Heart size={15} /><span>{p.wearable.length} you’d wear</span></div><div className="saved-tally"><Sparkles size={15} /><span>{p.favorite.length - p.wearable.length} you admire</span></div><button className="text-button undo-button" disabled={!session.votes.length || reacting} onClick={event => { if (event.detail <= 1) undo(); }}><RotateCcw size={14} />Undo last reaction</button>{session.votes.length >= 6 && <button className="outline-button early-result" onClick={() => navigate('portrait')}>See your portrait<ArrowRight size={14} /></button>}<div className="keyboard-hint"><span>ON A KEYBOARD</span><p><kbd>←</kbd> pass <kbd>→</kbd> wear <kbd>↓</kbd> unsure</p></div></aside>
        <section className="swipe-zone" aria-label="Outfit to react to">
          <div className="outfit-card" key={current.id} data-look-id={current.id} style={{ background: current.background, transform: `translateX(${drag}px) rotate(${drag * .035}deg)` }} onPointerDown={e => {
            if (e.button !== 0 || !e.isPrimary || lock.current) return;
            pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lookId: current.id };
            e.currentTarget.setPointerCapture(e.pointerId);
          }} onPointerMove={e => {
            const start = pointer.current;
            if (!start || start.id !== e.pointerId) return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (Math.abs(dx) > Math.abs(dy)) setDrag(Math.max(-110, Math.min(110, dx)));
          }} onPointerUp={e => {
            const start = pointer.current;
            pointer.current = null;
            if (start && start.id === e.pointerId && start.lookId === current.id && Math.abs(e.clientX - start.x) > 85 && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y) * 1.3) cast(e.clientX > start.x ? 'wear' : 'pass');
            setDrag(0);
          }} onPointerCancel={() => { pointer.current = null; setDrag(0); }} onLostPointerCapture={() => { pointer.current = null; setDrag(0); }}>
            <div className="outfit-card-top"><span>STYLR / THE LOOKS</span><span>{current.pattern === 'plain' ? 'SHAPE & FEEL' : 'PATTERN & PLAY'}</span></div>
            <FashionModel body={session.body} look={current} />
            {Math.abs(drag) > 30 && <span className="swipe-stamp" aria-hidden="true">{drag > 0 ? 'I’D WEAR IT' : 'NOT MY THING'}</span>}
            <div className="outfit-card-bottom"><h2>{current.name}</h2><p>{current.pieces.join(' / ')}</p></div>
          </div>
          <div className="reaction-buttons"><button className="reaction pass" aria-disabled={reacting} onClick={event => { if (event.detail <= 1) cast('pass'); }}><span><X size={25} strokeWidth={1.3} /></span>Not my thing</button><button className="reaction unsure" aria-disabled={reacting} onClick={event => { if (event.detail <= 1) cast('unsure'); }}><span><ArrowDown size={22} strokeWidth={1.3} /></span>Not sure</button><button className="reaction wear" aria-disabled={reacting} onClick={event => { if (event.detail <= 1) cast('wear'); }}><span><Heart size={25} strokeWidth={1.4} /></span>I’d wear it</button></div>
          <button className="admire-button" aria-disabled={reacting} onClick={event => { if (event.detail <= 1) cast('admire'); }}><Sparkles size={14} />Love the look, but not for me</button>
        </section>
        <aside className="feedback-panel"><p className="eyebrow">THE LITTLE NUANCES</p><h2>There’s more<br />to a <em>yes or no.</em></h2><p>Love the silhouette, not the color? Your details help separate the two.</p>
          <details className="feedback-details" key={current.id} open={draft.note || draft.more.length || draft.less.length ? true : undefined}><summary>Add a little context <span>· optional</span></summary><div className="feedback-fields">
            {(['more', 'less'] as const).map(kind => <fieldset key={kind}><legend>{kind === 'more' ? 'More of this' : 'Less of this'}</legend><div className={`trait-pills ${kind === 'less' ? 'less-pills' : ''}`}>{TRAIT_KEYS.map(t => <button key={t} aria-pressed={draft[kind].includes(t)} onClick={() => toggleTrait(t, kind)}>{TRAITS[t]}</button>)}</div></fieldset>)}
            <label htmlFor="look-note" className="feedback-label">In your own words</label><textarea id="look-note" maxLength={600} value={draft.note} onChange={e => changeDraft({ note: e.target.value })} placeholder="Love these trousers. I’d pair them with a simpler top…" aria-describedby="note-help" />
            <p className="tiny-copy" id="note-help">{draft.note.length}/600 · Tags guide future looks. Notes are kept for you, not interpreted by AI. {problem ? 'Saving is unavailable or paused.' : saving ? 'Saving draft…' : 'Draft saved as you type.'}</p>
          </div></details>
          <div className="margin-note"><span>Remember</span><p>You can love more than one kind of thing.</p></div>
        </aside>
      </div>
    </main>}

    {session.step === 'portrait' && <main id="study-main" className="portrait-page page-enter">
      <section className="portrait-heading"><p className="eyebrow"><span className="tiny-star" aria-hidden="true">✳</span> YOUR PERSONAL STYLE STUDY</p><h1 ref={heading} tabIndex={-1}>{p.heading}</h1><p>{p.summary}</p><div className="portrait-actions"><button className="outline-button" onClick={() => download()}><Download size={16} />Download your notes</button><button className="text-button" onClick={() => download(true)}>Export session JSON</button>{!allDone && <button className="text-button" onClick={goDiscover}>Keep exploring<ArrowRight size={16} /></button>}<button className="text-button" onClick={() => navigate('model')}><SlidersHorizontal size={14} />Adjust figure</button></div><p className="evidence-line">{session.votes.length} reactions · {p.wearable.length} looks you’d wear · {p.favorite.length - p.wearable.length} you admire · {p.provisional ? 'Early signals only' : 'A starting point, not a verdict'}</p></section>
      {p.favorite.length > 0 && <>
        <section className="moodboard-section"><div className="section-heading"><h2>Your visual language</h2><span>A MOODBOARD, IN YOUR PROPORTIONS</span></div><div className="moodboard">{p.favorite.map(({ look, vote }, i) => <figure key={look.id} className="mood-tile" style={{ background: look.background }}><span className="mood-number">{String(i + 1).padStart(2, '0')}</span><FashionModel body={session.body} look={look} /><figcaption><strong>{look.name}</strong><span>{vote.reaction === 'wear' ? 'I’d wear it' : 'Admired · not for me'}</span></figcaption></figure>)}</div></section>
        <section className="interpretation"><div className="interpretation-title"><p className="eyebrow">READING BETWEEN THE LOOKS</p><h2>What ties<br />it <em>together.</em></h2><p>Themes across your reactions and explicit tags. Admiration counts as inspiration, not a promise you’d wear it. Keep what feels right.</p><div className="ingredient-list">{p.traits.map(t => <span key={t}>{TRAITS[t]}</span>)}</div></div><div className="directions-list">{(p.formulas.length ? p.ranked.slice(0, 2) : []).map(({ direction, liked, seen }, i) => <article key={direction}><span className="direction-index">0{i + 1}</span><div><h3>{DIRECTIONS[direction].name}</h3><p>{DIRECTIONS[direction].description}</p><p className="tiny-copy">{liked} positive of {seen} explored in this direction</p><div className="formula"><span>AN OUTFIT IDEA, NOT A RULE</span><p>{DIRECTIONS[direction].formula}</p></div></div></article>)}{!p.formulas.length && <p className="empty-state">No consistent direction yet. Your individual favorites are a better starting point than a label.</p>}</div></section>
      </>}
      <section className="shopping-section"><div className="section-heading shopping-heading"><div><p className="eyebrow">FROM FEELING TO FINDING</p><h2>Pieces to start with.</h2></div><label className="budget-control">Per-piece search budget<select value={session.budget} onChange={e => setSession(s => ({ ...s, budget: e.target.value as Session['budget'] }))}><option value="any">Open to exploring</option><option value="50">Under $50</option><option value="100">Under $100</option><option value="200">Under $200</option></select></label></div><p className="shopping-note">Start with what you own. If something is missing, these links search pieces from looks you said you’d wear—not admired-only looks. Prices, stock and fit are unverified; the budget is a search hint, not a guarantee.</p>
        <fieldset className="constraints"><legend>Exclude from shopping suggestions (not from your moodboard)</legend><div>{(Object.keys(CONSTRAINT_LABELS) as Constraint[]).map(rule => <label key={rule}><input type="checkbox" checked={session.exclusions.includes(rule)} onChange={e => setSession(s => ({ ...s, exclusions: e.target.checked ? [...s.exclusions, rule] : s.exclusions.filter(c => c !== rule) }))} />{CONSTRAINT_LABELS[rule]}</label>)}</div></fieldset>
        {suggested.length ? <div className="shopping-grid">{suggested.map(look => <article key={look.id} className="shopping-card"><div className="shopping-figure" style={{ background: look.background }}><FashionModel body={session.body} look={look} /></div><div className="shopping-copy"><span className="eyebrow">YOU SAID YOU’D WEAR IT</span><h3>{look.name}</h3><p>Try the combination, or borrow just one piece.</p>{look.pieces.map(piece => <a key={piece} href={shoppingUrl(piece, session.budget)} target="_blank" rel="noopener noreferrer" aria-label={`Search for ${piece} (opens a new tab)`}>{piece}<ExternalLink size={13} /></a>)}</div></article>)}</div> : <p className="empty-state">{p.wearable.length ? 'Your exclusions rule out the saved wearable looks. Keep them—you don’t need to compromise. Explore more looks, or change an exclusion if you want to.' : 'No wearable favorites yet. Admiring a look doesn’t mean you want to buy it. Choose “I’d wear it” on a look to see its pieces here.'}</p>}
      </section>
      {session.votes.some(v => v.note || v.more.length || v.less.length) && <section className="your-notes"><div className="section-heading"><h2>In your own words</h2><span>THE DETAILS THAT MATTER</span></div><div className="notes-grid">{session.votes.filter(v => v.note || v.more.length || v.less.length).map(vote => <article key={vote.lookId}><p className="eyebrow">{LOOKS.find(l => l.id === vote.lookId)?.name} · {WORDS[vote.reaction]}</p>{vote.note && <blockquote>“{vote.note}”</blockquote>}{vote.more.length > 0 && <p>More: {vote.more.map(t => TRAITS[t]).join(', ')}</p>}{vote.less.length > 0 && <p>Less: {vote.less.map(t => TRAITS[t]).join(', ')}</p>}</article>)}</div></section>}
      <section className="closing-note"><span className="tiny-star" aria-hidden="true">✳</span><h2>Style is a conversation.<br /><em>You get to change your mind.</em></h2><div><button className="outline-button revisit-button" disabled={reacting} onClick={undo}><RotateCcw size={15} />Revisit the last look</button><button className="text-button" onClick={() => setDialog('reset')}>Start a fresh study</button><button className="text-button" onClick={() => window.print()}>Print your moodboard</button></div></section>
    </main>}
    <footer className="site-footer"><span>STYLR — A PERSONAL STYLE STUDY</span><span>{problem ? 'Saving unavailable or paused' : saving ? 'Saving…' : 'Saved in this browser only'} · No photo upload</span><button onClick={() => setDialog('reset')}>Clear my study</button><a href="https://zo.computer" target="_blank" rel="noopener noreferrer">Built on Zo ↗</a></footer>
    <dialog ref={modal} className="study-dialog" aria-labelledby="dialog-heading" aria-busy={clearing} onCancel={event => { if (clearing) event.preventDefault(); else setDialog(null); }} onClose={() => { if (!clearing) setDialog(null); }}>
      {clearing && <p role="status">Clearing saved data… Waiting for other tabs to finish saving. Keep this tab open.</p>}
      <fieldset disabled={clearing}>
      {dialog === 'undo' ? <><p className="eyebrow">BEFORE YOU GO BACK</p><h2 id="dialog-heading">Keep this new note?</h2><p>Going back replaces this look’s unfinished note and tags with your previous reaction. Download your notes first, or stay on this look.</p><div className="dialog-actions"><button className="outline-button" autoFocus onClick={() => setDialog(null)}>Keep editing</button><button className="primary-button" onClick={() => { performUndo(); setDialog(null); }}>Discard draft & undo</button><button className="text-button" onClick={() => download()}>Download notes first</button></div></> : dialog === 'reset' ? <><p className="eyebrow">A CLEAN PAGE</p><h2 id="dialog-heading">Start again?</h2>{problem === 'clear-failed' && <p role="alert">Could not clear the saved study. Data is still stored in this browser. You can retry or keep your study.</p>}<p>This clears saved figures, reactions and notes, including any version saved by another tab. Download your current notes first if you’d like to keep them.</p><div className="dialog-actions"><button className="outline-button" autoFocus onClick={() => setDialog(null)}>Keep my study</button><button className="primary-button" onClick={async () => { const cleared = await reset(); if (cleared) setDialog(null); setAnnouncement(cleared ? 'Study cleared.' : 'Could not clear the saved study. Your data is still stored in this browser.'); }}>Clear & start again</button><button className="text-button" onClick={() => download()}>Download notes first</button></div></> : dialog === 'reload' ? <><p className="eyebrow">TWO VERSIONS</p><h2 id="dialog-heading">Load the saved study?</h2>{problem !== 'conflict' && problem && <p role="alert">The saved version could not be loaded. This tab’s work has been kept.</p>}<p>This replaces this tab’s unsaved changes. Download them before continuing if you want to keep a copy.</p><div className="dialog-actions"><button className="outline-button" autoFocus onClick={() => setDialog(null)}>Keep this tab</button><button className="primary-button" onClick={() => { const loaded = reloadSaved(); if (loaded) setDialog(null); setAnnouncement(loaded ? 'Saved version loaded.' : 'Could not load saved study. This tab’s work has been kept.'); }}>Load saved version</button></div></> : <><p className="eyebrow">ABOUT THIS PROTOTYPE</p><h2 id="dialog-heading">Follow your inclination.</h2><p>A small experiment in discovering what you like, on a figure that feels closer to you.</p><ul><li>24 curated illustrations across six directions. Explore all of them, or see an early portrait after six.</li><li>Proportions carry into every outfit but never restrict style selection. Illustrations are not virtual try-on, measurements or fit predictions.</li><li>Reactions and more/less tags guide the next cards. Notes are saved, not interpreted by AI. Shopping exclusions are explicit controls.</li><li>The portrait is a summary of curated tags and your reactions—not a definitive classification. This small collection doesn’t represent every body or style.</li><li>Shopping links leave the app for Google searches. No verified inventory, prices, affiliate links or automatic purchases.</li><li>Figure settings, drafts and notes are stored in this browser. No account, uploads or analytics. There is no cross-device sync; clearing browser data clears your study.</li></ul><button className="primary-button" autoFocus onClick={() => setDialog(null)}>Back to my study<ArrowRight size={16} /></button></>}
      </fieldset>
    </dialog>
  </div>;
}
