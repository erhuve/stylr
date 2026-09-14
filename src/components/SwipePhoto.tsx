import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react';
import { Heart, RotateCcw, X } from 'lucide-react';
import type { Photo, PhotoReaction } from '../lib/photo-types';

export type SwipePhotoHandle = { react: (reaction: PhotoReaction) => void };
type Props = {
  photo: Photo;
  disabled: boolean;
  undoDisabled: boolean;
  observations: number;
  credit: ReactNode;
  onReact: (id: string, reaction: PhotoReaction) => boolean;
  onUndo: () => void;
  ref?: Ref<SwipePhotoHandle>;
};
type Gesture = { pointerId: number; x: number; y: number; width: number; intent: 'pending' | 'horizontal' };

export default function SwipePhoto({ photo, disabled, undoDisabled, observations, credit, onReact, onUndo, ref }: Props) {
  const [resource, setResource] = useState({ id: photo.id, src: photo.src, attempt: 0, status: 'loading' });
  const [offset, setOffset] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const readyElement = useRef<HTMLImageElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Set<number>());
  const consumed = useRef(false);
  const ready = resource.id === photo.id && resource.src === photo.src && resource.status === 'ready';

  if (resource.id !== photo.id || resource.src !== photo.src) {
    setResource({ id: photo.id, src: photo.src, attempt: 0, status: 'loading' });
  }

  function validImage(element: HTMLImageElement | null): element is HTMLImageElement {
    return !!element && element === image.current && element.isConnected && element.getAttribute('src') === photo.src && element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }
  function visibleImage() {
    const element = image.current;
    if (!validImage(element) || readyElement.current !== element) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  function cancelGesture() {
    const active = gesture.current;
    gesture.current = null;
    setOffset(0);
    if (active && surface.current?.hasPointerCapture(active.pointerId)) surface.current.releasePointerCapture(active.pointerId);
  }
  function loaded(element: HTMLImageElement) {
    if (!validImage(element)) return;
    readyElement.current = element;
    setResource(previous => ({ ...previous, status: 'ready' }));
  }
  function react(reaction: PhotoReaction) {
    if (disabled || consumed.current || (reaction !== 'unsure' && !visibleImage())) return;
    cancelGesture();
    consumed.current = true;
    if (!onReact(photo.id, reaction)) consumed.current = false;
  }
  useImperativeHandle(ref, () => ({ react }));

  useLayoutEffect(() => {
    readyElement.current = null;
    consumed.current = false;
    cancelGesture();
    if (image.current) loaded(image.current);
  }, [photo.id, photo.src, resource.attempt]);

  useEffect(() => {
    if (disabled) cancelGesture();
  }, [disabled]);

  useEffect(() => {
    const down = (event: PointerEvent) => {
      pointers.current.add(event.pointerId);
      if (pointers.current.size > 1 || !event.isPrimary) cancelGesture();
    };
    const end = (event: PointerEvent) => { pointers.current.delete(event.pointerId); };
    const cancel = (event: PointerEvent) => { end(event); cancelGesture(); };
    const blur = () => { pointers.current.clear(); cancelGesture(); };
    const visibility = () => { if (document.visibilityState !== 'visible') blur(); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || consumed.current || !visibleImage() || event.button !== 0 || !event.isPrimary || pointers.current.size > 1 || (event.target as HTMLElement).closest('button,a')) return;
    cancelGesture();
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth, intent: 'pending' };
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { cancelGesture(); }
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    if (disabled || !visibleImage() || event.buttons !== 1) { cancelGesture(); return; }
    const x = event.clientX - active.x, y = event.clientY - active.y;
    if (active.intent === 'pending') {
      if (Math.hypot(x, y) < 12) return;
      if (Math.abs(x) <= Math.abs(y) * 1.35) { cancelGesture(); return; }
      active.intent = 'horizontal';
    }
    if (Math.abs(y) > Math.max(36, Math.abs(x) * .8)) { cancelGesture(); return; }
    const limit = Math.min(active.width * .32, 120);
    setOffset(Math.max(-limit, Math.min(limit, x)));
  }
  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.button !== 0) { cancelGesture(); return; }
    const x = event.clientX - active.x, y = event.clientY - active.y;
    const threshold = Math.max(64, Math.min(112, active.width * .22));
    cancelGesture();
    if (active.intent === 'horizontal' && Math.abs(x) >= threshold && Math.abs(x) > Math.abs(y) * 1.5) react(x > 0 ? 'wear' : 'pass');
  }

  return <div className="photo-vote-column">
    <figure className="photo-current" data-photo-id={photo.id}>
      <div className="photo-label"><span>{photo.view === 'detail' ? 'DETAIL · VISIBLE PIECES ONLY' : 'THE OUTFIT'}</span><span>{String(observations + 1).padStart(2, '0')}</span></div>
      <div ref={surface} className="current-image swipe-photo" role="group" aria-label="Outfit photo" aria-describedby="photo-swipe-hint" aria-keyshortcuts="ArrowLeft ArrowRight" tabIndex={0} data-ready={ready} data-dragging={offset !== 0} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} onContextMenu={cancelGesture} onDragStart={event => event.preventDefault()}>
        <img key={`${photo.id}:${photo.src}:${resource.attempt}`} ref={image} src={photo.src} alt={photo.description} draggable={false} fetchPriority="high" style={{ transform: offset ? `translateX(${offset}px) rotate(${offset / 45}deg)` : 'none' }} onLoad={event => loaded(event.currentTarget)} onError={event => {
          if (event.currentTarget !== image.current || !event.currentTarget.isConnected) return;
          readyElement.current = null;
          cancelGesture();
          setResource(previous => ({ ...previous, status: 'failed' }));
        }} />
        <span className={`swipe-intent ${offset < 0 ? 'swipe-pass' : 'swipe-wear'}`} aria-hidden="true" data-visible={Math.abs(offset) > 24}>{offset < 0 ? 'Not for me' : 'Would wear'}</span>
        {!ready && <div className="image-warning" role="status"><p>{resource.status === 'failed' ? 'This photo couldn’t load.' : 'Loading this look…'}</p><p>Reactions unlock when the photo loads.</p><div><button disabled={disabled} onClick={() => {
          readyElement.current = null;
          cancelGesture();
          setResource(previous => ({ ...previous, attempt: previous.attempt + 1, status: 'loading' }));
        }}>Retry image</button><button disabled={disabled} onClick={() => react('unsure')}>Skip unavailable photo</button></div></div>}
      </div>
      {credit}
    </figure>
    <div className="photo-reactions"><button data-reaction="pass" aria-disabled={!ready || disabled} onClick={() => react('pass')}><X size={17} />Not for me</button><button data-reaction="wear" aria-disabled={!ready || disabled} onClick={() => react('wear')}><Heart size={17} />I’d wear this</button></div>
    <div className="photo-secondary-reactions"><button data-reaction="admire" aria-label="Admire, not for me" aria-disabled={!ready || disabled} onClick={() => react('admire')}>Admire</button><button data-reaction="unsure" aria-label="Not sure / skip" aria-disabled={disabled} onClick={() => react('unsure')}>Not sure / skip</button><button className="photo-undo" aria-label="Undo last reaction" aria-disabled={undoDisabled} onClick={() => { if (!undoDisabled) { cancelGesture(); onUndo(); } }}><RotateCcw size={14} />Undo</button></div>
    <div className="photo-card-footer"><p id="photo-swipe-hint" className="photo-swipe-hint">Swipe or use ← →<span>Left to pass · right to wear. Buttons work too.</span></p><span>{observations} {observations === 1 ? 'reaction' : 'reactions'}</span></div>
  </div>;
}
