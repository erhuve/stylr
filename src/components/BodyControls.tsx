import type { Photo, PhotoSession } from '../lib/photo-types';
import { bodyDistance, bodySelection } from '../lib/body-reference';
import BodySilhouette from './BodySilhouette';
import '../body-controls.css';

type Props = { body: PhotoSession['body']; photos: Photo[]; disabled: boolean; onChange: (body: NonNullable<PhotoSession['body']>) => void };
export default function BodyControls({ body, photos, disabled, onChange }: Props) {
  const selection = bodySelection(body);
  const controls = [
    { axis: 'build' as const, title: 'Overall build', min: 1, max: 3, left: 'Slender', right: 'Fuller / broader' },
    { axis: 'shoulderHip' as const, title: 'Shoulders & hips', min: -1, max: 1, left: 'Hips wider', right: 'Shoulders wider' },
    { axis: 'waist' as const, title: 'Waist shape', min: 0, max: 2, left: 'Straighter sides', right: 'More defined waist' },
  ];
  const previews = [...photos].sort((first, second) => bodyDistance(first.id, selection) - bodyDistance(second.id, selection)).slice(0, 3);
  return <section className="body-controls" aria-label="Body reference preferences">
    <h2>Start with your proportions.</h2>
    <p>Adjust the figure to the build you want to see.</p>
    <div className="body-editor">
      <div className="body-figure"><BodySilhouette {...selection} /><small>Shape guide</small></div>
      <fieldset disabled={disabled}><legend className="sr-only">Choose all three proportions</legend>
        {controls.map(control => <div className="body-axis" key={control.axis}>
          <label htmlFor={`body-${control.axis}`}>{control.title}</label>
          <input id={`body-${control.axis}`} type="range" min={control.min} max={control.max} step="0.01" value={selection[control.axis]} aria-valuetext={`${Math.round((selection[control.axis] - control.min) / 2 * 100)}% from ${control.left} toward ${control.right}`} onChange={event => onChange({ ...selection, [control.axis]: Number(event.target.value) })} />
          <div className="body-endpoints" aria-hidden="true"><span>{control.left}</span><span>{control.right}</span></div>
        </div>)}
      </fieldset>
    </div>
    <div className="body-results"><strong>Nearby real outfits</strong><span role="status">{photos.length ? `${photos.length} ${photos.length === 1 ? 'match' : 'matches'}` : 'No reviewed matches — adjust your proportions'}</span></div>
    <div className="body-previews" aria-label="Matching body references">{previews.map(photo => <img key={photo.id} src={photo.src} alt={photo.description} />)}</div>
    <details><summary>How matching works</summary><small>The figure changes continuously. Photos update when nearby reviewed references change; our limited library cannot supply a different photo at every position. All three traits must be reviewed and nearby. This is a visual guide, not a measurement or fit prediction.</small></details>
  </section>;
}
