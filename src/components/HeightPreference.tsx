import { useEffect, useRef, useState } from 'react';
import { MIN_HEIGHT_CM, MAX_HEIGHT_CM, getReportedHeight } from '../lib/height-reference';
import type { Photo, PhotoSession } from '../lib/photo-types';

type Unit = NonNullable<PhotoSession['heightUnit']>;
type Props = {
  heightCm?: number | null;
  unit: Unit;
  photos: Photo[];
  disabled: boolean;
  onChange: (preferences: Pick<PhotoSession, 'heightCm' | 'heightUnit'>) => void;
  onValidityChange: (valid: boolean) => void;
};
function fields(height?: number | null) {
  if (height == null) return { cm: '', feet: '', inches: '' };
  const tenths = Math.round(height / 2.54 * 10);
  return { cm: String(height), feet: String(Math.floor(tenths / 120)), inches: String(tenths % 120 / 10) };
}
export default function HeightPreference({ heightCm, unit, photos, disabled, onChange, onValidityChange }: Props) {
  const [values, setValues] = useState(() => fields(heightCm));
  const [error, setError] = useState('');
  const lastEmitted = useRef(heightCm);
  useEffect(() => { onValidityChange(true); }, [onValidityChange]);
  useEffect(() => {
    if (heightCm === lastEmitted.current) return;
    lastEmitted.current = heightCm;
    setValues(fields(heightCm));
    setError('');
    onValidityChange(true);
  }, [heightCm, onValidityChange]);
  const known = photos.filter(photo => getReportedHeight(photo.id)).length;
  const near = heightCm == null ? 0 : photos.filter(photo => {
    const reference = getReportedHeight(photo.id);
    return reference && Math.abs(reference.heightCm - heightCm) <= 15;
  }).length;
  function change(key: keyof typeof values, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    const blank = unit === 'cm' ? next.cm === '' : next.feet === '' && next.inches === '';
    const feet = Number(next.feet);
    const inches = Number(next.inches);
    const cm = unit === 'cm' ? Number(next.cm) : Math.round((feet * 12 + inches) * 2.54 * 100) / 100;
    const valid = blank || (Number.isFinite(cm) && cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM && (unit === 'cm' || (next.feet !== '' && Number.isInteger(feet) && inches >= 0 && inches < 12)));
    setError(valid ? '' : `Enter ${MIN_HEIGHT_CM}–${MAX_HEIGHT_CM} cm, or the equivalent in feet and inches (inches must be below 12).`);
    onValidityChange(valid);
    if (valid) {
      lastEmitted.current = blank ? null : cm;
      onChange({ heightCm: blank ? null : cm, heightUnit: unit });
    }
  }
  function switchUnit(next: Unit) {
    setValues(fields(heightCm));
    setError('');
    onValidityChange(true);
    onChange({ heightCm: heightCm ?? null, heightUnit: next });
  }
  return <fieldset className="height-preference" disabled={disabled}>
    <legend>Your height <span>optional</span></legend>
    <div className="height-fields">
      {unit === 'cm' ? <label htmlFor="height-cm">Centimeters<input id="height-cm" type="number" inputMode="decimal" min={MIN_HEIGHT_CM} max={MAX_HEIGHT_CM} step="any" placeholder="e.g. 170" value={values.cm} onChange={event => change('cm', event.target.value)} aria-invalid={!!error} aria-describedby="height-help height-error" /></label> : <>
        <label htmlFor="height-feet">Feet<input id="height-feet" type="number" inputMode="numeric" min="2" max="8" step="1" value={values.feet} onChange={event => change('feet', event.target.value)} aria-invalid={!!error} aria-describedby="height-help height-error" /></label>
        <label htmlFor="height-inches">Inches<input id="height-inches" type="number" inputMode="decimal" min="0" max="11.99" step="any" placeholder="0" value={values.inches} onChange={event => change('inches', event.target.value)} aria-invalid={!!error} aria-describedby="height-help height-error" /></label>
      </>}
      <label htmlFor="height-unit">Units<select id="height-unit" value={unit} onChange={event => switchUnit(event.target.value as Unit)}><option value="cm">cm</option><option value="ft-in">ft / in</option></select></label>
      <button type="button" className="text-button height-clear" disabled={heightCm == null && !values.cm && !values.feet && !values.inches} onClick={() => { setValues(fields(null)); setError(''); onValidityChange(true); lastEmitted.current = null; onChange({ heightCm: null, heightUnit: unit }); }}>Clear height</button>
    </div>
    <p id="height-help" className="field-note">Prioritizes similar source-reported heights without hiding other photos. We never estimate height from an image. Your height stays in this browser.</p>
    <p className="height-coverage" role="status">{known} of {photos.length} matching references {known === 1 ? 'has' : 'have'} a source-reported height.{heightCm != null ? ` ${near} within 15 cm of yours.` : ''} Unknown heights remain included.</p>
    <p id="height-error" className="height-error" role={error ? 'alert' : undefined}>{error}</p>
  </fieldset>;
}
