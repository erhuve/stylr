import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Download, Heart, RotateCcw, X } from 'lucide-react';
import { PHOTOS } from '../lib/photo-catalog';
import { FEATURE_LABELS, eligiblePhotos, nextPhoto, photoEvidence, photoNotes, votePhoto, undoPhoto, photoMatches } from '../lib/photo-session';
import { usePhotoStudy } from '../lib/use-photo-state';
import type { Feature, Photo, PhotoReaction, PhotoSession } from '../lib/photo-types';
import '../study.css';
import '../photo-study.css';
import PhotoMoodboard from '../components/PhotoMoodboard';

const ranges = { all: 'All looks', women: 'Women’s looks', men: 'Men’s looks' };
const frames = { all: 'All body references', smaller: 'Smaller frame', mid: 'Mid frame', fuller: 'Fuller frame' };
const exclusions = { 'no-skirts': 'No skirts / dresses', 'no-shorts': 'No shorts', 'no-heels': 'No heels', 'no-boots': 'No boots' } as const;
const featureKeys = Object.keys(FEATURE_LABELS) as Feature[];
const emptyDraft = (id: string) => ({ photoId: id, note: '', more: [] as Feature[], less: [] as Feature[] });
const introIds = ['pexels-15345393', 'pexels-7237068', 'pexels-7240000', 'pexels-12056633'];

function Credit({ photo }: { photo: Photo }) {
  return <figcaption className="photo-credit">Photo: <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.creator}</a><span> / </span><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.licenseUrl.includes('pexels') ? 'Pexels' : 'Unsplash'}</a></figcaption>;
}

export default function PhotoStudy() {
  const { session, setSession, problem, saving, reset, reloadSaved } = usePhotoStudy();
  const [catalog, setCatalog] = useState(false);
  const [feature, setFeature] = useState<Feature | 'all'>('all');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'about' | 'reset' | 'reload' | 'undo' | 'preferences' | null>(null);
  const pendingPreferences = useRef<Partial<PhotoSession> | null>(null);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(false);
  const [imageState, setImageState] = useState<{ id: string; ok: boolean }>({ id: '', ok: false });
  const [imageAttempt, setImageAttempt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const actionUntil = useRef(0);
  const resetPending = useRef(false);
  const current = nextPhoto(session, PHOTOS);
  const eligible = eligiblePhotos(session, PHOTOS);
  const remaining = eligible.filter(p => !session.votes.some(v => v.photoId === p.id)).length;
  const draft = current && session.draft?.photoId === current.id ? session.draft : current ? emptyDraft(current.id) : undefined;
  const dirty = !!draft && !!(draft.note.trim() || draft.more.length || draft.less.length);
  const canUndo = !!session.votes.length && eligiblePhotos(session, PHOTOS).some(p => p.id === session.votes.at(-1)?.photoId);
  const evidence = photoEvidence(session, PHOTOS);
  const availableMatches = photoMatches(session, PHOTOS);
  const favoriteIds = new Set(session.votes.filter(v => v.reaction === 'wear').map(v => v.photoId));
  const admired = session.votes.filter(v => v.reaction === 'admire').length;
  const eligibleIds = new Set(eligible.map(p => p.id));
  const favorites = PHOTOS.filter(p => favoriteIds.has(p.id) && eligibleIds.has(p.id));
  const admiredIds = new Set(session.votes.filter(v => v.reaction === 'admire').map(v => v.photoId));
  const admiredPhotos = PHOTOS.filter(p => admiredIds.has(p.id) && eligibleIds.has(p.id));
  const suggestions = availableMatches.filter(p => !favoriteIds.has(p.id));
  const catalogPhotos = eligible.filter(p => feature === 'all' || p.features.includes(feature));
  const imageReady = current?.id === imageState.id && imageState.ok;
  const previewPhotos = [...eligible].sort((a, b) => (introIds.includes(b.id) ? 1 : 0) - (introIds.includes(a.id) ? 1 : 0)).slice(0, 4);

  useEffect(() => {
    if (!saving && !problem) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving, problem]);

  useEffect(() => {
    if (session.step === 'discover' && current && !session.draft) setSession(s => ({ ...s, draft: emptyDraft(current.id) }));
  }, [current?.id, session.step, session.draft, setSession]);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [session.step, catalog]);
  useEffect(() => {
    const el = dialogRef.current;
    if (dialog && el && !el.open) {
      focusReturn.current = document.activeElement as HTMLElement;
      el.showModal();
      el.querySelector<HTMLButtonElement>(dialog === 'about' ? '.primary-button' : '.outline-button')?.focus();
    }
    if (!dialog && el?.open) { el.close(); focusReturn.current?.focus(); }
  }, [dialog]);

  function guard() {
    if (Date.now() < actionUntil.current || busy) return false;
    actionUntil.current = Date.now() + 650;
    setLock(true);
    window.setTimeout(() => setLock(false), 650);
    return true;
  }
  function vote(reaction: PhotoReaction, failedImage = false) {
    if (!current || dialog || (!imageReady && !failedImage) || !guard()) return;
    setSession(s => votePhoto(s, current.id, reaction, PHOTOS));
    setNotice(reaction === 'unsure' ? (draft?.more.length || draft?.less.length ? 'Skipped the outfit reaction; your explicit detail choices were saved.' : 'Skipped. No negative preference recorded.') : 'Outfit reaction saved.');
  }
  function navigate(step: PhotoSession['step']) {
    if (busy) return;
    setCatalog(false); setSession(s => ({ ...s, step }));
  }
  function feedback(kind: 'more' | 'less', value: Feature) {
    if (!current || !draft || busy) return;
    setSession(s => {
      const d = s.draft?.photoId === current.id ? s.draft : emptyDraft(current.id);
      const other = kind === 'more' ? 'less' : 'more';
      return { ...s, draft: { ...d, [kind]: d[kind].includes(value) ? d[kind].filter(t => t !== value) : [...d[kind], value], [other]: d[other].filter(t => t !== value) } };
    });
  }
  function applyPreferences(change: Partial<PhotoSession>) {
    const next = { ...session, ...change };
    const losesDraft = session.draft && !eligiblePhotos(next, PHOTOS).some(p => p.id === session.draft?.photoId);
    if (losesDraft && dirty) { pendingPreferences.current = change; setDialog('preferences'); return; }
    setSession(s => ({ ...s, ...change, ...(losesDraft ? { draft: undefined } : {}) }));
  }
  function confirmPreferences() {
    if (pendingPreferences.current) setSession(s => ({ ...s, ...pendingPreferences.current, draft: undefined }));
    pendingPreferences.current = null;
    setDialog(null);
  }
  function undo(confirmed = false) {
    if (!canUndo || busy || lock) return;
    if (dirty && !confirmed) { setDialog('undo'); return; }
    if (!guard()) return;
    setSession(s => undoPhoto(s, PHOTOS)); setDialog(null); setNotice('Last reaction undone. Its outfit and feedback are restored.');
  }
  function saveFile(raw = false) {
    const text = raw ? JSON.stringify(session, null, 2) : photoNotes(session, PHOTOS);
    const blob = new Blob([text], { type: raw ? 'application/json' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stylr-photo-study.${raw ? 'json' : 'md'}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function clear() {
    if (resetPending.current) return;
    resetPending.current = true; setBusy(true);
    try { if (await reset()) { setDialog(null); setCatalog(false); setNotice('Photo study cleared. Your illustrated study was not changed.'); } }
    finally { resetPending.current = false; setBusy(false); }
  }
  async function reload() {
    if (busy) return; setBusy(true);
    try { if (await reloadSaved()) { setDialog(null); setNotice('Saved photo study loaded.'); } }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || dialog || session.step !== 'discover' || catalog || (e.target as HTMLElement).closest('input,textarea,select,button,a,[contenteditable]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); vote('wear'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); vote('pass'); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const tiles = (photos: Photo[], predictions = false) => photos.map(p => <figure className="photo-tile" key={p.id}>
    <div className="tile-image"><img src={p.src} alt={p.description} loading="lazy" /></div>
    <div className="tile-caption"><span className="eyebrow">{p.view === 'detail' ? 'Detail reference' : 'Outfit reference'}{predictions ? ' · To explore' : ''}</span><h3>{p.title}</h3><p>{p.description}</p><Credit photo={p} /></div>
  </figure>);

  return <div className="study-shell photo-app" onKeyDownCapture={e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest('[data-reaction],.photo-undo')) e.preventDefault(); }}>
    <a className="skip-link" href="#photo-main">Skip to the study</a>
    <header className="site-header"><a className="wordmark" href="/" aria-label="Stylr home" onClick={e => { e.preventDefault(); navigate('setup'); }}>stylr<span>✳</span></a><nav className="step-nav" aria-label="Photo study steps">{(['setup', 'discover', 'portrait'] as const).map((step, i) => <button key={step} onClick={() => navigate(step)} disabled={busy} aria-current={!catalog && session.step === step ? 'step' : undefined}><span>0{i + 1}</span>{['Your starting point', 'Explore', 'Your portrait'][i]}</button>)}</nav><button className="about-button" onClick={() => setDialog('about')}>THE STUDY</button></header>
    <div className="sr-only" role="status" aria-live="polite">{notice} {session.step === 'discover' && current ? `Current outfit: ${current.title}. ${current.description}` : ''}</div>
    {problem && <aside className="photo-warning" role="alert"><p>{problem === 'conflict' ? 'Another tab changed the saved photo study. Saving is paused to protect both versions.' : problem === 'invalid' ? 'The saved photo study cannot be read. It has not been overwritten.' : problem === 'clear-failed' ? 'Clearing failed. Your study has not been cleared; saving is paused.' : 'Browser storage is unavailable. Changes may not survive a reload.'}</p><button onClick={() => saveFile(true)}>Download current session</button>{problem === 'conflict' && <button onClick={() => setDialog('reload')}>Load saved version</button>}{problem === 'invalid' && <button onClick={() => setDialog('reset')}>Clear unreadable study</button>}</aside>}
    <main id="photo-main">
      {catalog ? <section className="photo-gallery page-container"><p className="eyebrow">The reference library</p><h1 ref={heading} tabIndex={-1}>More ways to get dressed.</h1><p className="photo-intro">{catalogPhotos.length} color references in your selected range. Original proportions, real clothing, credited photographers. Browsing does not count as a reaction.</p><div className="gallery-controls"><label>Explore a detail<select value={feature} onChange={e => setFeature(e.target.value as Feature | 'all')}><option value="all">Every detail</option>{featureKeys.map(f => <option key={f} value={f}>{FEATURE_LABELS[f]}</option>)}</select></label><button className="outline-button" onClick={() => setCatalog(false)}><ArrowLeft size={16} />Back to study</button></div>{catalogPhotos.length ? <div className="photo-grid">{tiles(catalogPhotos)}</div> : <p>No references match this combination. Try another detail or change your starting point.</p>}</section>
      : session.step === 'setup' ? <section className="photo-setup page-container"><div className="photo-controls"><p className="eyebrow"><span className="tiny-star">✳</span>A study in personal style</p><h1 ref={heading} tabIndex={-1}>Real clothes.<br /><em>Your own inclination.</em></h1><p className="photo-intro">Find the shapes, colors and details you actually want to wear. No assigned aesthetic. No perfect body required.</p>
        <fieldset><legend>Which clothing range would you like to explore?</legend><div className="photo-options">{Object.entries(ranges).map(([value, label]) => <button key={value} aria-pressed={session.collection === value} onClick={() => applyPreferences({ collection: value as PhotoSession['collection'] })}>{label}</button>)}</div><p className="field-note">Clothing collections, not rules about who can wear them.</p></fieldset>
        <div className="setup-selects"><label>Sex <span>optional</span><select value={session.sex} onChange={e => setSession(s => ({ ...s, sex: e.target.value as PhotoSession['sex'] }))}><option value="unspecified">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="intersex">Intersex</option></select></label><label>Body reference <span>optional</span><select value={session.frame} onChange={e => setSession(s => ({ ...s, frame: e.target.value as PhotoSession['frame'] }))}>{Object.entries(frames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><p className="field-note">Sex is self-reported, stays in this browser, and does not determine your style or clothing range. Body reference gently prioritizes broad visual builds, not exact sizes. Photos do not reshape or predict fit.</p>
        <details className="photo-boundaries"><summary>Anything you don’t want to see?</summary><div>{Object.entries(exclusions).map(([key, label]) => <label key={key}><input type="checkbox" checked={session.exclusions.includes(key as keyof typeof exclusions)} onChange={() => applyPreferences({ exclusions: session.exclusions.includes(key as keyof typeof exclusions) ? session.exclusions.filter(x => x !== key) : [...session.exclusions, key as keyof typeof exclusions] })} />{label}</label>)}</div><p className="field-note">When a relevant garment is hidden, that photo is excluded rather than guessed.</p></details>
        <button className="primary-button start-button" disabled={!eligible.length || busy} onClick={() => navigate('discover')}>{session.votes.length ? 'Continue my photo study' : 'Start with real outfits'}<ArrowRight size={18} /></button><p className="under-button">{eligible.length} eligible references · Explore at your pace · No account</p><button className="text-button" onClick={() => setCatalog(true)}>Browse the photo collection<ArrowRight size={15} /></button><p className="coverage-note">Still growing: fuller-bodied menswear and complete-outfit references are underrepresented. We mix references rather than pretend the collection covers everyone equally.</p>
      </div><div className="photo-mosaic" aria-label="A sample of the color photo collection">{previewPhotos.map(p => { return <figure key={p.id}><img src={p.src} alt={p.description} /><Credit photo={p} /></figure>; })}<p>Different shapes. Different moods. Room for more than one you.</p></div></section>
      : session.step === 'discover' ? <section className="page-container photo-discover"><div className="photo-discover-heading"><div><p className="eyebrow">{ranges[session.collection]} · {remaining} still to explore</p><h1 ref={heading} tabIndex={-1}>Would you wear this?</h1><p>React to the clothes—not the person or the setting.</p></div><button className="outline-button" onClick={() => navigate('setup')}>Change starting point</button></div>
        {current ? <div className="photo-quiz"><aside className="photo-progress"><p className="eyebrow">Your observations</p><p className="reaction-count">{session.votes.length}<span> reactions</span></p><p>We explore different details before narrowing in. Skips are not dislikes.</p><button className="text-button photo-undo" disabled={!canUndo || lock || busy} onClick={() => undo()}><RotateCcw size={15} />Undo last reaction</button><button className="text-button" onClick={() => navigate('portrait')}>See my evolving portrait<ArrowRight size={15} /></button></aside>
          <div className="photo-vote-column"><figure className="photo-current" data-photo-id={current.id}><div className="photo-label"><span>{current.view === 'detail' ? 'DETAIL REFERENCE · VISIBLE PIECES ONLY' : 'REAL OUTFIT REFERENCE'}</span><span>COLOR STUDY</span></div><div className="current-image"><img key={`${current.id}-${imageAttempt}`} src={current.src} alt={current.description} onLoad={() => setImageState({ id: current.id, ok: true })} onError={() => setImageState({ id: current.id, ok: false })} /></div><Credit photo={current} /></figure>
            {!imageReady && <div className="image-warning" role="status">Waiting for the photo. Reactions unlock when it loads.<button onClick={() => setImageAttempt(a => a + 1)}>Retry image</button><button disabled={lock} onClick={() => vote('unsure', true)}>Skip unavailable photo</button></div>}
            <div className="photo-reactions"><button data-reaction="pass" disabled={!imageReady || lock || busy} onClick={() => vote('pass')}><X size={17} />Not for me</button><button data-reaction="wear" disabled={!imageReady || lock || busy} onClick={() => vote('wear')}><Heart size={17} />I’d wear this</button></div><div className="photo-secondary-reactions"><button data-reaction="admire" disabled={!imageReady || lock || busy} onClick={() => vote('admire')}>Admire, not for me</button><button data-reaction="unsure" disabled={!imageReady || lock || busy} onClick={() => vote('unsure')}>Not sure / skip</button></div>
          </div><aside className="photo-details"><p className="eyebrow">The reference</p><h2>{current.title}</h2><p>{current.description}</p>{current.view === 'detail' && <p className="field-note">A detail view: hidden shoes and garments are not treated as known.</p>}<label className="note-label" htmlFor="photo-note">What catches your eye?<textarea id="photo-note" value={draft?.note || ''} maxLength={600} placeholder="The sleeves, not the color…" onChange={e => { const note = e.target.value; setSession(s => ({ ...s, draft: { ...(s.draft?.photoId === current.id ? s.draft : emptyDraft(current.id)), note } })); }} /></label><p className="field-note">Notes save with this reaction. Only the explicit detail buttons below affect scores.</p><details><summary>More / less of a detail</summary>{(['more', 'less'] as const).map(kind => <fieldset key={kind}><legend>{kind === 'more' ? 'More of' : 'Less of'}</legend><div className="photo-tags">{featureKeys.map(f => <button key={f} aria-pressed={draft?.[kind].includes(f) || false} onClick={() => feedback(kind, f)}>{FEATURE_LABELS[f]}</button>)}</div></fieldset>)}</details></aside>
        </div> : <div className="photo-empty"><button className="text-button photo-undo" disabled={!canUndo || lock || busy} onClick={() => undo()}><RotateCcw size={15} />Undo last reaction</button><h2>{eligible.length ? 'You’ve explored this selection.' : 'No references match these boundaries.'}</h2><p>{eligible.length ? 'Keep your portrait or change your starting point to explore other clothing.' : 'Try changing your clothing range or exclusions. Your existing reactions are safe.'}</p><button className="primary-button" onClick={() => navigate('portrait')}>View my portrait<ArrowRight size={16} /></button><button className="text-button" onClick={() => navigate('setup')}>Change starting point</button></div>}
      </section>
      : <PhotoMoodboard favorites={favorites} admiredPhotos={admiredPhotos} suggestions={suggestions} evidence={evidence} observations={session.votes.length} totalSaved={favoriteIds.size + admired} headingRef={heading} onExplore={() => navigate('discover')} onSettings={() => navigate('setup')} onDownload={saveFile} onBrowse={() => setCatalog(true)} onUndo={() => undo()} undoDisabled={!canUndo || lock || busy} />}
    </main>
    <footer className="site-footer"><span>{saving ? 'Saving…' : problem ? 'Saving needs attention' : 'Saved on this browser'} · No account or analytics</span><a href="/illustrated" onClick={e => { if (saving || problem) { e.preventDefault(); setNotice('Your latest changes are not safely saved. Wait or download your session before leaving.'); } }}>Open original illustrated study</a><button onClick={() => setDialog('reset')}>Clear photo study</button><a href="https://zo.computer" target="_blank" rel="noreferrer">Built on Zo ↗</a></footer>
    <dialog ref={dialogRef} className="study-dialog" aria-labelledby="photo-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) { pendingPreferences.current = null; setDialog(null); } }}>
      {dialog === 'about' ? <><h2 id="photo-dialog-title">A study, not a verdict.</h2><p>{PHOTOS.length} real color references from Pexels and Unsplash. React to clothing rather than judging the photographed person. Credits and license links accompany every image; no model endorsement is implied.</p><p>The catalog is hand-tagged. Background, lighting, pose and body can influence a reaction. Body coverage is incomplete, especially fuller-bodied menswear. There is no fit prediction and no automatic inference of sex or identity.</p><p>Your optional sex, selections, notes and reactions stay in this browser. JSON downloads include them. Original illustrated data remains separate and available through the footer.</p><button className="primary-button" autoFocus onClick={() => setDialog(null)}>Back to my study</button></> : <>
        <h2 id="photo-dialog-title">{dialog === 'reset' ? 'Clear this photo study?' : dialog === 'reload' ? 'Load the saved version?' : dialog === 'preferences' ? 'Change your selection and replace this draft?' : 'Undo and replace this draft?'}</h2>
        <p>{dialog === 'reset' ? 'This clears the photo study in this browser, including optional profile choices and notes. The original illustrated study stays untouched.' : dialog === 'reload' ? 'This replaces the photo study open here with the version saved by another tab. Download your current work first if you want to keep both.' : dialog === 'preferences' ? 'This reference is outside your new selection. Changing it discards only the unfinished note and detail choices for this card; your recorded reactions stay.' : 'Your current unfinished note and detail choices will be replaced by the previous reaction’s feedback.'}</p>
        <button className="text-button" disabled={busy} onClick={() => saveFile(true)}>Download current session first</button>
        <div className="dialog-actions">
          <button className="outline-button" autoFocus disabled={busy} onClick={() => { pendingPreferences.current = null; setDialog(null); }}>Keep editing</button>
          <button className="primary-button" disabled={busy || lock} onClick={() => { if (dialog === 'reset') void clear(); else if (dialog === 'reload') void reload(); else if (dialog === 'preferences') confirmPreferences(); else undo(true); }}>{busy ? 'Working…' : dialog === 'reset' ? 'Clear photo study' : dialog === 'reload' ? 'Load saved version' : dialog === 'preferences' ? 'Discard draft and change' : 'Discard draft and undo'}</button>
        </div>
      </>}
    </dialog>
  </div>;
}
