import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Download, SlidersHorizontal, X } from 'lucide-react';
import { FEATURE_LABELS } from '../lib/photo-session';
import type { FeatureEvidence, Photo } from '../lib/photo-types';
import '../photo-moodboard.css';

type BoardTab = 'saved' | 'wear' | 'admire' | 'suggested';
type BoardItem = { photo: Photo; kind: 'wear' | 'admire' | 'suggested' };
const statuses = { wear: 'Would wear', admire: 'Admire', suggested: 'Untried suggestion' };

function BoardPhoto({ photo, kind }: BoardItem) {
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  return <figure ref={cardRef} tabIndex={-1} aria-label={`${photo.title}: ${statuses[kind]}`} className="board-card" data-photo-id={photo.id} data-kind={kind}>
    <div className="board-image">
      {failed && <div className="board-image-failed" role="status"><p>{retrying ? 'Retrying photo…' : 'Photo unavailable'}</p><button ref={retryRef} aria-disabled={retrying} onClick={() => { if (!retrying) { setRetrying(true); setAttempt(a => a + 1); } }}>Retry {photo.title}</button></div>}
      <img key={attempt} src={photo.src} alt={photo.description} loading="eager" style={failed ? { display: 'none' } : undefined} onError={() => { setFailed(true); setRetrying(false); }} onLoad={() => { if (document.activeElement === retryRef.current) cardRef.current?.focus({ preventScroll: true }); setFailed(false); setRetrying(false); }} />
      <span className={`board-status board-status-${kind}`}>{statuses[kind]}</span>
    </div>
    <figcaption className="board-caption"><h2>{photo.title}</h2><p>{photo.view === 'detail' && <span>Detail · </span>}<a href={photo.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Photo by ${photo.creator}: ${photo.title}`}>{photo.creator}</a><span> / </span><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.licenseUrl.includes('pexels') ? 'Pexels' : 'Unsplash'}</a></p></figcaption>
  </figure>;
}

type Props = {
  favorites: Photo[];
  admiredPhotos: Photo[];
  suggestions: Photo[];
  evidence: FeatureEvidence[];
  observations: number;
  totalSaved: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onExplore: () => void;
  onSettings: () => void;
  onDownload: (raw?: boolean) => void;
  onBrowse: () => void;
  onUndo: () => void;
  undoDisabled: boolean;
};

export default function PhotoMoodboard({ favorites, admiredPhotos, suggestions, evidence, observations, totalSaved, headingRef, onExplore, onSettings, onDownload, onBrowse, onUndo, undoDisabled }: Props) {
  const [tab, setTab] = useState<BoardTab>('saved');
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const saved: BoardItem[] = [...favorites.map(photo => ({ photo, kind: 'wear' as const })), ...admiredPhotos.map(photo => ({ photo, kind: 'admire' as const }))];
  const sections: Record<BoardTab, BoardItem[]> = {
    saved,
    wear: saved.filter(item => item.kind === 'wear'),
    admire: saved.filter(item => item.kind === 'admire'),
    suggested: suggestions.map(photo => ({ photo, kind: 'suggested' as const })),
  };
  const items = sections[tab];
  const tabs: { key: BoardTab; label: string }[] = [{ key: 'saved', label: 'Your picks' }, { key: 'wear', label: 'Would wear' }, { key: 'admire', label: 'Admire' }, { key: 'suggested', label: 'To explore' }];
  const meaningful = evidence.filter(e => e.seen || e.explicit);
  const filtered = totalSaved > saved.length;

  function closeNotes(next?: () => void) {
    notesRef.current?.close();
    setNotesOpen(false);
    returnFocus.current?.focus();
    next?.();
  }

  useEffect(() => {
    const dialog = notesRef.current;
    if (notesOpen && dialog && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement;
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('.board-close')?.focus();
    } else if (!notesOpen && dialog?.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [notesOpen]);

  return <section className="page-container photo-portrait moodboard-portrait">
    <header className="board-heading"><div><p className="eyebrow">Your evolving style</p><h1 ref={headingRef} tabIndex={-1}>Your moodboard.</h1><p className="board-subtitle">{saved.length ? `${saved.length} saved looks · ${observations} observations` : 'A place for the looks you want to come back to.'}{saved.length > 0 && observations < 12 ? ' · Early inspiration' : ''}</p></div><div className="board-actions"><button className="outline-button" onClick={() => setNotesOpen(true)}><SlidersHorizontal size={15} />Style notes</button><button className="primary-button" onClick={onExplore}>Keep exploring<ArrowRight size={16} /></button></div></header>
    <div className="board-toolbar" role="group" aria-label="Moodboard views">{tabs.map(({ key, label }) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}<span>{sections[key].length}</span></button>)}</div>
    <p className="board-context" aria-live="polite">{tab === 'suggested' ? 'Untried references to explore—not saved favorites or confirmed matches.' : tab === 'admire' ? 'Visual inspiration you admired, not clothes you said you would wear.' : tab === 'wear' ? 'The clothes you said you would wear.' : 'Your own picks. Admired looks stay distinct from clothes you would wear.'}{filtered && <> Some saved looks are hidden by your current boundaries. <button onClick={onSettings}>Edit boundaries</button></>}</p>
    {items.length ? <div className="board-masonry" aria-label={`${tabs.find(t => t.key === tab)!.label} photos`}>{items.map(item => <BoardPhoto key={`${item.kind}-${item.photo.id}`} {...item} />)}</div> : <div className="board-empty"><span aria-hidden="true">✳</span><h2>{tab === 'suggested' ? 'No untried suggestions in this selection.' : filtered && !saved.length ? 'Your picks are still saved.' : tab === 'wear' ? 'No would-wear picks here yet.' : tab === 'admire' ? 'No admired looks here yet.' : 'Start with a look that feels like you.'}</h2><p>{tab === 'suggested' ? 'You may have explored the available matches, or your current boundaries and reactions leave none. Your saved picks are unchanged.' : filtered && !saved.length ? 'Your current clothing range or boundaries hide these photos. Change them to see your saved picks again.' : 'Wear and admire reactions build this board. Skipped and rejected outfits never fill it.'}</p><button className="primary-button" onClick={filtered && !saved.length && tab !== 'suggested' ? onSettings : onExplore}>{filtered && !saved.length && tab !== 'suggested' ? 'Change boundaries' : 'Explore more outfits'}<ArrowRight size={16} /></button></div>}
    <dialog ref={notesRef} className="board-notes" aria-labelledby="board-notes-title" onCancel={e => { e.preventDefault(); closeNotes(); }} onClose={() => setNotesOpen(false)} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
      <div className="board-notes-header"><div><p className="eyebrow">Behind the pictures</p><h2 id="board-notes-title">Your style notes</h2></div><button className="board-close" aria-label="Close style notes" autoFocus onClick={() => closeNotes()}><X size={20} /></button></div>
      <p>{observations} observations · {favorites.length} visible would-wear picks · {admiredPhotos.length} visible admired looks. These are provisional patterns in a limited collection, not a definitive style classification.</p>
      <section className="evidence-section"><h3>What your reactions suggest</h3><p className="field-note">Detail scores account for exposure and repeated contributors. Outfit reactions are correlations; explicit more/less choices carry more weight. Your written notes are preserved, not interpreted.</p><div className="evidence-grid">{meaningful.map(e => <div className="evidence-item" key={e.feature}><div><strong>{FEATURE_LABELS[e.feature]}</strong><span>{e.score > 0 ? 'Leaning toward' : e.score < 0 ? 'Leaning away' : 'Still open'}</span></div><p>{e.seen} seen · {e.wear} wear · {e.admire} admire · {e.pass} pass{e.explicit ? ` · ${e.explicit} explicit signals` : ''}</p></div>)}</div>{!meaningful.length && <p>No directional evidence yet. Skips alone do not define a style.</p>}</section>
      <p className="field-note">Bodies, poses, lighting and backgrounds can influence a reaction. Coverage is still uneven, especially fuller-bodied menswear. Body references do not predict fit. Your profile, notes and reactions remain in this browser.</p>
      <div className="board-downloads"><button className="outline-button" onClick={() => onDownload()}><Download size={15} />Download style notes</button><button className="text-button" onClick={() => onDownload(true)}>Export session JSON</button><button className="text-button photo-undo" disabled={undoDisabled} onClick={() => closeNotes(onUndo)}>Undo last reaction</button><button className="text-button" onClick={() => closeNotes(onBrowse)}>Browse all eligible references</button></div><p className="field-note">JSON includes your optional sex and profile choices. Downloads contain notes and source links, not a photo pack.</p>
    </dialog>
  </section>;
}
