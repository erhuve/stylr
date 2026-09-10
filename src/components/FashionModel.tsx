import { useId } from 'react';
import type { Body, Look } from '../lib/style-types';

type Props = {
  body: Body;
  look: Look;
  className?: string;
  neutral?: boolean;
};
const fraction = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50)) / 100;
const sides = [-1, 1] as const;

export default function FashionModel({ body, look, className, neutral = false }: Props) {
  const id = `fashion-${useId().replace(/[^a-zA-Z0-9_-]/g, char => `_${char.charCodeAt(0).toString(16)}_`)}`;
  const url = (name: string) => `url(#${id}-${name})`;
  const s = 29 + fraction(body.shoulders) * 20;
  const b = 29 + fraction(body.chest) * 24;
  const w = 23 + fraction(body.waist) * 29;
  const h = 34 + fraction(body.hips) * 27;
  const wy = 202 + fraction(body.torso) * 44;
  const by = 118 + (wy - 118) * .43;
  const hy = wy + 39;
  const cy = hy + 32;
  const ky = cy + (507 - cy) * .49;
  const arm = Math.max(s, b, w, h) + 19;
  const wrist = arm - 3;
  const wristY = 290 + fraction(body.torso) * 30;
  const knee = 25 + fraction(body.hips) * 3;
  const kw = 11 + fraction(body.hips) * 5;
  const ankle = 7 + fraction(body.hips) * 2;
  const top = neutral ? 'tank' : look.top;
  const [topColor, bottomColor, shoeColor, accent] = neutral ? ['#d9d1c5', '#92978f', '#69645b', '#a5977e'] : look.colors;
  const ink = '#3b302e';
  const paper = '#eee8dc';
  const hair = '#302a29';
  const ease = neutral || top === 'tank' ? 1 : top === 'blouse' || top === 'knit' || top === 'hoodie' ? 10 : 6;
  const sw = s + (top === 'tank' ? -3 : ease * .6);
  const bw = b + ease;
  const ww = w + ease;
  const coat = top === 'blazer' || top === 'jacket';
  const hem = coat ? hy + (top === 'blazer' ? 13 : 2) : wy + (top === 'hoodie' ? 22 : top === 'knit' ? 14 : top === 'vest' ? 10 : 3);
  const hemW = coat ? h + ease : ww + (hem - wy) * .14;
  const skirt = !neutral && (look.bottom === 'skirt' || look.bottom === 'pleated');
  const short = neutral || look.bottom === 'shorts';
  const bottomHem = short ? cy + (ky - cy) * (neutral ? .48 : .8) : skirt ? 445 + fraction(body.torso) * 10 : 515;
  const skirtW = h + (look.bottom === 'pleated' ? 28 : 22);
  const legHem = neutral ? 16 + fraction(body.hips) * 8 : look.bottom === 'wide' ? 24 + fraction(body.hips) * 8 : look.bottom === 'flare' ? 27 + fraction(body.hips) * 5 : short ? h * .48 : 15 + fraction(body.hips) * 5;
  const legKnee = neutral ? kw : look.bottom === 'wide' ? legHem : look.bottom === 'flare' ? kw + 2 : kw + 6;
  const patterned = !neutral && look.pattern !== 'plain';
  const bottomPatterned = patterned && /floral|check|gingham|stripe|plaid/i.test(look.pieces[1]);
  const topPatterned = patterned && (!bottomPatterned || /floral|check|gingham|stripe|plaid/i.test(look.pieces[0]));
  const neckline = top === 'tank' ? 'Q -16 149 0 149 Q 16 149 16 113' : top === 'blouse' ? 'Q -13 134 1 131 Q 14 132 16 113' : top === 'vest' ? 'L 0 160 L 16 113' : 'Q 0 132 16 113';
  const torso = `M -12 87 L -13 109 Q -20 113 ${-s} 118 Q ${-s - 7} 132 ${-b} ${by} C ${-b} ${by + 23} ${-w} ${wy - 19} ${-w} ${wy} C ${-w} ${wy + 12} ${-h} ${hy - 19} ${-h} ${hy} Q ${-h - 3} ${cy - 1} -15 ${cy - 7} Q 0 ${cy - 14} 15 ${cy - 7} Q ${h + 3} ${cy - 1} ${h} ${hy} C ${h} ${hy - 19} ${w} ${wy + 12} ${w} ${wy} C ${w} ${wy - 19} ${b} ${by + 23} ${b} ${by} Q ${s + 7} 132 ${s} 118 Q 20 113 13 109 L 12 87 Z`;
  const bodice = `M -16 113 ${neckline} Q 25 113 ${sw} 119 Q ${sw - 4} 139 ${bw} ${by + 4} C ${bw} ${by + 24} ${ww} ${wy - 14} ${ww} ${wy} Q ${hemW} ${hem - 8} ${hemW} ${hem} Q 0 ${hem + 7} ${-hemW} ${hem} Q ${-hemW} ${hem - 8} ${-ww} ${wy} C ${-ww} ${wy - 14} ${-bw} ${by + 24} ${-bw} ${by + 4} Q ${-sw + 4} 139 ${-sw} 119 Q -25 113 -16 113 Z`;
  const bottom = skirt
    ? `M ${-w - 2} ${wy - 2} Q 0 ${wy + 3} ${w + 2} ${wy - 2} C ${w + 5} ${wy + 18} ${h + 5} ${hy - 10} ${h + 5} ${hy + 8} L ${skirtW} ${bottomHem - 3} Q ${skirtW * .55} ${bottomHem + 6} 0 ${bottomHem} Q ${-skirtW * .6} ${bottomHem + 8} ${-skirtW} ${bottomHem - 2} L ${-h - 5} ${hy + 8} C ${-h - 5} ${hy - 10} ${-w - 5} ${wy + 18} ${-w - 2} ${wy - 2} Z`
    : `M ${-w - 2} ${wy - 2} Q 0 ${wy + 3} ${w + 2} ${wy - 2} C ${w + 3} ${wy + 17} ${h + 4} ${hy - 12} ${h + 4} ${hy + 7} ${short ? `L ${knee + legHem} ${bottomHem}` : `Q ${knee + legKnee} ${ky} ${25 + legHem} ${bottomHem}`} Q ${25} ${bottomHem + 4} ${Math.max(2, 25 - legHem)} ${bottomHem} L 4 ${cy + 3} Q 0 ${cy - 4} -4 ${cy + 3} L ${-Math.max(2, 25 - legHem)} ${bottomHem} Q -25 ${bottomHem + 4} ${-25 - legHem} ${bottomHem} ${short ? `L ${-h - 4} ${hy + 7}` : `Q ${-knee - legKnee} ${ky} ${-h - 4} ${hy + 7}`} C ${-h - 4} ${hy - 12} ${-w - 3} ${wy + 17} ${-w - 2} ${wy - 2} Z`;
  const cloth = (d: string, color: string, pattern = false) => <g>
    <path d={d} fill={color} stroke={ink} strokeOpacity=".6" strokeWidth=".85" />
    <path d={d} fill={url('wash')} stroke="none" />
    {pattern && <path d={d} fill={url(look.pattern)} stroke="none" />}
  </g>;
  const seam = (d: string, opacity = .36, width = .8) => (
    <path d={d} fill="none" stroke={ink} strokeWidth={width} opacity={opacity} />
  );
  const button = (x: number, y: number, r = 1.7) => <g>
    <circle cx={x} cy={y} r={r} fill={paper} stroke={ink} strokeWidth=".65" />
    <path d={`M ${x - .45} ${y} h .9`} stroke={ink} strokeWidth=".6" />
  </g>;
  const label = neutral ? 'Adjustable figure in a fitted tank and short leggings' : `${look.name}: ${look.pieces.join(', ')}`;

  return <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 320 560"
    className={className}
    role="img"
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`}
    focusable="false"
    style={{ display: 'block', width: '100%', height: 'auto' }}
  >
    <title id={`${id}-title`}>{label}</title>
    <desc id={`${id}-description`}>Full-length, hand-drawn editorial fashion illustration with {body.hair} hair. Shoulder, chest, waist, hip and torso proportions follow the selected body settings.{neutral ? ' Bare feet and close-fitting, quiet layers keep the body proportions visible.' : ` ${look.pattern === 'plain' ? 'Solid-color' : look.pattern} fabric, ${look.shoes}, ${look.accessory === 'none' ? 'no accessories' : `a ${look.accessory}`}.`}</desc>
    <defs>
      <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2=".16">
        <stop offset="0" stopColor={ink} stopOpacity=".19" />
        <stop offset=".28" stopColor="#fffaf0" stopOpacity=".13" />
        <stop offset=".57" stopColor="#fffaf0" stopOpacity=".02" />
        <stop offset=".83" stopColor={ink} stopOpacity=".09" />
        <stop offset="1" stopColor={ink} stopOpacity=".2" />
      </linearGradient>
      <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2=".25">
        <stop stopColor={ink} stopOpacity=".16" />
        <stop offset=".38" stopColor="#fff6e5" stopOpacity=".12" />
        <stop offset=".7" stopColor="#fff6e5" stopOpacity="0" />
        <stop offset="1" stopColor={ink} stopOpacity=".17" />
      </linearGradient>
      <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2=".25">
        <stop stopColor="#272426" />
        <stop offset=".4" stopColor="#4d3e37" />
        <stop offset=".7" stopColor={hair} />
        <stop offset="1" stopColor="#242125" />
      </linearGradient>
      <pattern id={`${id}-stripe`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={top === 'knit' || top === 'tee' ? 'rotate(90)' : 'rotate(-3)'}>
        <path d="M 2 0 V 10" stroke={paper} strokeWidth="2.5" strokeOpacity=".65" />
        <path d="M 5 0 V 10" stroke={ink} strokeWidth=".7" strokeOpacity=".3" />
      </pattern>
      <pattern id={`${id}-check`} width="15" height="15" patternUnits="userSpaceOnUse">
        <path d="M 0 4 H 15 M 4 0 V 15" stroke={ink} strokeOpacity=".18" strokeWidth="6" />
        <path d="M 0 11 H 15 M 11 0 V 15" stroke={paper} strokeOpacity=".63" strokeWidth="1.2" />
        <path d="M 0 1 H 15 M 1 0 V 15" stroke={ink} strokeOpacity=".4" strokeWidth=".65" />
      </pattern>
      <pattern id={`${id}-floral`} width="21" height="25" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path d="M 5 15 Q 11 10 9 3 M 16 25 Q 19 20 17 16" stroke="#586454" strokeOpacity=".7" strokeWidth=".65" fill="none" /><path d="M 8 11 Q 1 7 5 6 Q 9 6 8 11 M 18 21 Q 12 18 14 17 Q 18 17 18 21" fill="#68735f" fillOpacity=".6" /><g fill={accent} fillOpacity=".8"><ellipse cx="9" cy="4" rx="2" ry="3" /><ellipse cx="9" cy="4" rx="2" ry="3" transform="rotate(65 9 4)" /><ellipse cx="9" cy="4" rx="2" ry="3" transform="rotate(-65 9 4)" /><circle cx="17" cy="16" r="2.2" /></g><circle cx="9" cy="4" r="1" fill={paper} /></pattern>
      <pattern id={`${id}-rib`} width="4" height="7" patternUnits="userSpaceOnUse">
        <path d="M 1 0 V 7" stroke={ink} strokeOpacity=".1" strokeWidth=".65" />
        <path d="M 2 0 V 7" stroke={paper} strokeOpacity=".18" strokeWidth=".7" />
      </pattern>
      <clipPath id={`${id}-bodice`}><path d={bodice} /></clipPath>
      <clipPath id={`${id}-bottom`}><path d={bottom} /></clipPath>
      <clipPath id={`${id}-arm-skin`}>
        <rect x="-150" y={top === 'tank' || top === 'tee' ? 0 : wristY - 3} width="300" height="560" />
      </clipPath>
    </defs>
    <ellipse cx="160" cy="537" rx="65" ry="5" fill={ink} opacity=".08" />
    <g transform="translate(160 0)" strokeLinecap="round" strokeLinejoin="round">
      {body.hair !== 'crop' && <g fill={url('hair')} stroke={hair} strokeWidth=".8">
        <path d={body.hair === 'long' ? 'M -23 41 Q -35 52 -31 90 C -35 119 -50 151 -36 182 Q -24 188 -15 178 L 23 175 Q 42 177 37 154 C 25 113 33 89 29 60 Q 27 27 -1 27 Z' : 'M -24 42 Q -32 58 -29 83 L -31 108 Q -14 117 1 107 Q 21 116 31 102 L 28 61 Q 27 31 0 29 Z'} />
        {seam(body.hair === 'long' ? 'M -25 67 Q -22 122 -32 170 M 24 69 Q 18 111 29 162 M -20 119 Q -25 155 -21 174' : 'M -24 65 Q -25 91 -22 105 M 24 70 Q 22 90 26 102', .55)}
      </g>}
      {sides.map(side => <g key={`leg-${side}`} transform={`scale(${side} 1)`}>
        <path d={`M 4 ${hy + 9} Q ${h * .5} ${hy - 8} ${h - 1} ${hy + 7} Q ${h + 3} ${cy + 15} ${knee + kw} ${ky} Q ${knee + kw + 3} ${ky + 26} ${25 + ankle} 505 L ${25 + ankle} 516 Q 42 520 47 529 Q 49 534 42 535 L 19 535 Q 15 532 17 523 L ${25 - ankle} 505 Q ${knee - kw - 2} ${ky + 30} ${knee - kw} ${ky} Q 7 ${cy + 27} 4 ${cy + 3} Z`} fill={body.skin} stroke={ink} strokeWidth=".8" strokeOpacity=".5" />
        <path d={`M ${h - 4} ${hy + 13} Q ${h - 3} ${cy + 24} ${knee + kw - 3} ${ky} Q ${knee + kw} ${ky + 35} ${25 + ankle - 2} 506 L ${25 + ankle - 5} 512 Q ${knee + 3} ${ky + 36} ${knee + 3} ${ky} Q ${h * .65} ${cy} ${h - 4} ${hy + 13}`} fill={ink} opacity=".075" />
        {seam(`M ${knee - 4} ${ky + 2} Q ${knee + 1} ${ky - 1} ${knee + 5} ${ky + 2} M 21 508 Q 26 510 30 508 M 39 530 l 1 4 M 35 531 l .5 4`, .23, .65)}
      </g>)}
      <path d={torso} fill={body.skin} stroke={ink} strokeOpacity=".45" strokeWidth=".85" />
      <path d={torso} fill={url('skin')} />
      <path d="M -12 88 Q 0 100 12 88 L 12 101 Q 2 110 -12 100 Z" fill={ink} opacity=".12" />
      {seam(`M -11 112 Q -19 121 ${-s + 8} 123 M 11 112 Q 19 121 ${s - 8} 123 M -3 119 Q 0 122 3 119`, .24)}
      {sides.map(side => <g key={`arm-${side}`} transform={`scale(${side} 1)`}>
        <g clipPath={url('arm-skin')}>
          <path d={`M ${s - 5} 120 Q ${s + 11} 114 ${s + 17} 142 Q ${arm + 8} ${wy - 22} ${arm + 7} ${wy + 6} L ${wrist + 5} ${wristY} L ${wrist - 5} ${wristY + 1} Q ${arm - 5} ${wy + 42} ${arm - 10} ${wy + 7} Q ${s - 1} 170 ${s - 8} 138 Z`} fill={body.skin} stroke={ink} strokeOpacity=".48" strokeWidth=".85" />
          {seam(`M ${arm - 4} ${wy - 2} q -2 7 1 12 M ${wrist - 3} ${wristY - 6} l 6 1`, .23)}
        </g>
        {top !== 'tank' && (() => {
          const tee = top === 'tee', puff = top === 'blouse', shirtUnder = top === 'vest';
          const endY = tee ? by + 24 : wristY - 5;
          const endX = tee ? s + (arm - s) * .36 + 4 : wrist;
          const volume = puff ? 16 : top === 'knit' || top === 'hoodie' ? 12 : 7;
          const sleeve = `M ${s - 5} 119 Q ${s + volume + 10} 111 ${s + volume + 17} 147 Q ${arm + volume} ${tee ? endY - 7 : wy + 8} ${endX + (tee ? 10 : 7)} ${endY} Q ${endX} ${endY + 5} ${endX - 8} ${endY} Q ${arm - 10} ${tee ? by + 6 : wy + 4} ${s - 9} 139 Z`;
          return <g>{cloth(sleeve, shirtUnder ? paper : topColor, topPatterned && !shirtUnder)}
            {seam(`M ${s + 9} 133 Q ${s + 12} 141 ${s + 10} 150 M ${endX - 7} ${endY - 6} Q ${endX} ${endY - 2} ${endX + 7} ${endY - 6} M ${endX + 3} ${endY - 27} l -4 19`, .32)}
            {!tee && <>{cloth(`M ${wrist - 8} ${endY - 7} Q ${wrist} ${endY - 3} ${wrist + 7} ${endY - 7} L ${wrist + 6} ${endY + 3} Q ${wrist} ${endY + 5} ${wrist - 7} ${endY + 3} Z`, shirtUnder ? paper : topColor)}{button(wrist + 3, endY - 1, 1.2)}</>}
            {puff && seam(`M ${s + 17} 127 Q ${s + 23} 148 ${s + 19} 165 M ${arm + 8} ${wy + 3} Q ${arm + 12} ${wy + 19} ${wrist + 4} ${endY - 12} M ${wrist - 4} ${endY - 11} l -4 -17`, .25)}
          </g>;
        })()}
      </g>)}
      {!neutral && sides.map(side => <g key={`shoe-${side}`} transform={`scale(${side} 1)`}>
        {look.shoes === 'heels' ? <>
          {cloth('M 17 516 Q 23 521 31 520 Q 38 526 47 530 Q 53 536 43 536 L 32 536 Q 27 531 24 528 L 23 536 L 17 536 Z', shoeColor)}
          {seam('M 18 522 Q 31 529 44 532 M 18 531 h 5', .6)}
        </> : <>
          {cloth(look.shoes === 'boots' ? 'M 15 480 Q 25 484 36 480 L 35 516 Q 37 520 47 525 Q 55 530 48 535 L 17 535 Q 13 532 15 525 Z' : 'M 16 519 Q 21 525 29 522 L 33 517 Q 38 522 47 527 Q 54 533 47 536 L 17 536 Q 12 533 16 519 Z', shoeColor)}
          {look.shoes === 'flats' && <>{seam('M 17 525 Q 27 532 38 525 M 31 526 q -7 -5 -5 -1 q 4 4 5 1 q 7 -4 5 0 q -2 2 -5 0', .6)}<path d="M 18 519 Q 23 523 30 520" stroke={shoeColor} strokeWidth="3" fill="none" /></>}
          {look.shoes === 'loafers' && <>{seam('M 20 531 Q 18 525 29 525 Q 36 525 43 531 M 21 526 L 36 526', .75, 1.1)}<path d="M 24 526 h 7" stroke={paper} strokeOpacity=".5" strokeWidth="1.6" /></>}
          {look.shoes === 'sneakers' && <><path d="M 16 532 Q 29 535 48 532 L 47 536 H 17 Z" fill={paper} stroke={ink} strokeWidth=".6" />{[0, 1, 2].map(i => <path key={i} d={`M ${26 + i * 3} ${522 + i * 2} l 7 -1`} stroke={paper} strokeWidth="1.6" />)}{seam('M 21 526 l -2 5 M 38 525 q -3 3 -2 6', .55)}</>}
          {look.shoes === 'boots' && <>{seam('M 18 485 Q 25 488 33 485 M 31 489 L 30 519 Q 39 521 42 527 M 16 531 H 48', .65)}<path d="M 17 535 h 8 v 2 h -8 M 33 535 h 14 v 2 H 33" fill={ink} /></>}
        </>}
      </g>)}
      {cloth(bottom, bottomColor, bottomPatterned)}
      <g clipPath={url('bottom')}>
        {skirt ? Array.from({ length: look.bottom === 'pleated' ? 13 : 5 }, (_, i) => {
          const count = look.bottom === 'pleated' ? 12 : 4, t = (i / count) * 2 - 1;
          return <g key={i}><path d={`M ${t * w} ${wy + 5} Q ${t * h} ${hy + 19} ${t * skirtW} ${bottomHem + 3} L ${t * skirtW + 5} ${bottomHem + 4} Q ${t * h + 4} ${hy + 20} ${t * w} ${wy + 5}`} fill={ink} opacity={look.bottom === 'pleated' ? .12 : .065} />{seam(`M ${t * w + 2} ${wy + 9} Q ${t * h + 1} ${hy + 19} ${t * skirtW + 2} ${bottomHem - 5}`, .2, .65)}</g>;
        }) : sides.map(side => <g key={side} transform={`scale(${side} 1)`}>
          {!neutral && seam(`M ${w - 4} ${wy + 8} Q ${w - 6} ${wy + 28} ${h - 8} ${hy - 2} M ${h * .48} ${hy + 6} Q ${knee - 1} ${ky - 6} 25 ${bottomHem - 5}`, .38)}
          {neutral && seam(`M ${h - 5} ${hy + 8} L ${knee + legHem - 4} ${bottomHem - 5}`, .2)}
          <path d={`M ${h - 1} ${hy + 9} Q ${knee + legKnee - 4} ${ky} ${25 + legHem - 4} ${bottomHem} L ${25 + legHem + 4} ${bottomHem + 4} L ${h + 5} ${hy} Z`} fill={ink} opacity=".07" />
          {seam(`M ${Math.max(2, 25 - legHem)} ${bottomHem - 5} Q 25 ${bottomHem - 2} ${25 + legHem} ${bottomHem - 5}`, .33)}
        </g>)}
        {seam(`M ${-w - 3} ${wy + 5} Q 0 ${wy + 12} ${w + 3} ${wy + 5}`, .4)}
        {!neutral && !skirt && seam(`M 2 ${wy + 9} V ${hy - 3} q 7 0 7 -7`, .45)}
      </g>
      {top === 'hoodie' && cloth('M -15 106 Q -32 102 -35 119 Q -31 140 -17 145 L 0 130 L 18 145 Q 33 133 35 117 Q 31 101 15 106 L 0 116 Z', topColor)}
      {top === 'vest' && cloth(`M -16 113 Q 0 132 16 113 L ${s - 1} 120 L ${b - 2} ${by + 9} L ${w} ${wy + 10} H ${-w} L ${-b + 2} ${by + 9} L ${-s + 1} 120 Z`, paper)}
      {cloth(bodice, coat && top === 'blazer' ? paper : topColor, topPatterned && top !== 'blazer')}
      <g clipPath={url('bodice')}>
        {(top === 'knit' || top === 'tank') && <path d={bodice} fill={url('rib')} />}
        {!coat && <>
          {seam(`M ${-bw + 8} ${by + 10} Q ${-bw + 13} ${by + 23} ${-ww + 8} ${wy - 6} M ${bw - 8} ${by + 10} Q ${bw - 14} ${by + 27} ${ww - 7} ${wy - 4} M ${-hemW + 4} ${hem - 4} Q 0 ${hem + 1} ${hemW - 4} ${hem - 4}`, neutral ? .16 : .26)}
          {top !== 'tank' && seam(`M -9 ${hem - 2} q -5 -12 -3 -24 M 12 ${hem - 1} q 9 -12 7 -20`, .23)}
        </>}
        {(top === 'knit' || top === 'hoodie') && <path d={`M ${-hemW} ${hem - 8} Q 0 ${hem - 2} ${hemW} ${hem - 8} V ${hem + 5} H ${-hemW} Z`} fill={url('rib')} stroke={ink} strokeOpacity=".24" strokeWidth=".7" />}
        {top === 'blouse' && <>{seam('M -16 113 Q -14 141 2 136 Q 17 135 16 113 M -11 126 l -4 17 M -4 132 l -2 16 M 9 132 l 4 12', .4)}{seam(`M -20 ${wy - 22} q -5 15 -2 24 M 19 ${wy - 17} l -3 19`, .23)}</>}
        {top === 'tank' && seam('M -19 115 Q -18 153 0 153 Q 18 153 19 115', .4)}
        {(top === 'tee' || top === 'knit') && seam('M -17 114 Q 0 139 17 114', .45, 1.1)}
        {top === 'hoodie' && <>
          {cloth(`M -21 ${wy - 14} H 21 L 31 ${wy + 9} Q 0 ${wy + 15} -31 ${wy + 9} Z`, topColor)}
          {seam(`M -21 ${wy - 12} l -8 19 M 21 ${wy - 12} l 8 19`, .5, 1.3)}
          <path d="M -11 127 L -12 161 M 11 127 L 13 157" stroke={paper} strokeWidth="1.5" /><path d="M -12 159 v 4 M 13 155 v 4" stroke={ink} strokeWidth="1.4" />
        </>}
      </g>
      {coat && sides.map(side => <g key={`coat-${side}`} transform={`scale(${side} 1)`}>
        {top === 'blazer' && <>
          {cloth(`M 15 112 Q 26 114 ${sw} 119 Q ${sw - 4} 139 ${bw} ${by + 4} C ${bw} ${by + 24} ${ww} ${wy - 14} ${ww} ${wy} Q ${hemW} ${hem - 8} ${hemW} ${hem} Q 24 ${hem + 5} 7 ${hem - 1} Q 2 ${wy + 17} 6 ${wy - 1} L 12 ${by + 11} Z`, topColor, topPatterned)}
          {cloth(`M 16 112 L ${Math.max(25, sw * .7)} 123 L ${Math.max(23, sw * .54)} 140 L ${Math.max(28, sw * .7)} 145 L 6 ${wy - 1} L 13 146 L 8 133 Z`, topColor, topPatterned)}
          {seam(`M 9 ${wy - 4} L 24 147 M ${bw - 9} ${by + 6} Q ${ww - 10} ${wy - 3} ${hemW - 8} ${hem - 8}`, .36)}
        </>}
        {cloth(top === 'jacket' ? `M 13 ${by + 8} H ${Math.max(30, bw - 10)} V ${by + 33} Q 23 ${by + 39} 13 ${by + 33} Z` : `M 17 ${wy + 10} L ${hemW - 8} ${wy + 7} L ${hemW - 8} ${wy + 13} L 17 ${wy + 16} Z`, topColor, topPatterned)}
        {top === 'jacket' && <>{seam(`M 13 ${by + 14} H ${Math.max(30, bw - 10)} M 16 ${wy + 7} H ${hemW - 9} V ${hem - 8} H 16 Z`, .5)}{button((13 + Math.max(30, bw - 10)) / 2, by + 17, 1.3)}</>}
      </g>)}
      {(top === 'shirt' || top === 'jacket' || top === 'vest' || top === 'blazer') && <>
        {(top === 'shirt' || top === 'jacket') && seam(`M -2 131 V ${hem - 2} M 3 132 V ${hem - 2}`, .4)}
        {top !== 'blazer' && Array.from({ length: 4 }, (_, i) => <g key={i}>{button(1, (top === 'vest' ? 167 : 143) + i * (hem - (top === 'vest' ? 174 : 149)) / 3)}</g>)}
        {top === 'blazer' ? <>{button(10, wy + 4, 2.2)}{seam('M -12 113 L -1 132 L 11 114', .45)}</> : <>{cloth('M -13 107 L -1 122 L -12 136 L -23 117 Z', top === 'vest' ? paper : topColor, topPatterned && top !== 'vest')}{cloth('M 13 107 L 1 122 L 12 136 L 23 117 Z', top === 'vest' ? paper : topColor, topPatterned && top !== 'vest')}</>}
      </>}
      {!neutral && look.accessory === 'belt' && <>
        {cloth(`M ${-w - 2} ${wy + 3} Q 0 ${wy + 8} ${w + 2} ${wy + 3} V ${wy + 10} Q 0 ${wy + 15} ${-w - 2} ${wy + 10} Z`, accent)}
        <rect x="-5" y={wy + 5} width="12" height="8" rx="1.6" fill="none" stroke={paper} strokeWidth="1.7" /><path d={`M 0 ${wy + 9} h 8`} stroke={paper} strokeWidth="1.1" />
      </>}
      {!neutral && look.accessory === 'necklace' && <g fill="none" stroke={accent}><path d="M -13 109 Q -17 147 0 153 Q 19 146 13 109" strokeWidth="1.45" /><path d="M 0 151 Q -6 156 0 160 Q 6 156 0 151" fill={accent} strokeWidth=".8" /><path d="M -1 154 l 1 3" stroke={paper} strokeOpacity=".7" /></g>}
      {!neutral && look.accessory === 'scarf' && <>
        {cloth('M -13 106 Q 0 115 14 105 L 16 117 Q 6 129 -12 121 Z', accent)}
        {cloth(`M 5 119 Q 17 124 18 144 L 24 ${Math.min(by + 43, wy - 7)} L 9 ${Math.min(by + 48, wy - 2)} Q 14 149 -1 128 Z`, accent)}
        {cloth('M 0 119 Q 13 116 13 124 L 6 131 L -2 126 Z', accent)}
        {seam('M -11 114 Q 1 121 12 113 M 6 130 Q 13 144 13 161', .4)}
        <path d={`M 12 ${Math.min(by + 43, wy - 7)} l 9 -3`} stroke={paper} strokeWidth="2" strokeOpacity=".65" />
      </>}
      {!neutral && look.accessory === 'tie' && <>{cloth(`M -2 131 L 5 130 L 13 ${wy - 22} L 6 ${wy - 11} L -1 ${wy - 19} Z`, accent)}{cloth('M -5 122 L 6 122 L 8 129 L 1 136 L -5 128 Z', accent)}{seam(`M 3 139 L 8 ${wy - 27}`, .4)}</>}
      {!neutral && look.accessory === 'bag' && <g>
        <path d={`M ${s - 3} 121 Q ${h + 18} ${wy - 6} ${h + 12} ${hy + 19}`} fill="none" stroke={ink} strokeWidth="5" strokeOpacity=".7" />
        <path d={`M ${s - 3} 121 Q ${h + 18} ${wy - 6} ${h + 12} ${hy + 19}`} fill="none" stroke={accent} strokeWidth="3.2" />
        {cloth(`M ${h - 10} ${hy + 12} Q ${h + 10} ${hy + 8} ${h + 25} ${hy + 16} L ${h + 28} ${hy + 47} Q ${h + 10} ${hy + 58} ${h - 10} ${hy + 48} Z`, accent)}
        {seam(`M ${h - 8} ${hy + 19} Q ${h + 8} ${hy + 36} ${h + 24} ${hy + 21} M ${h - 5} ${hy + 43} Q ${h + 10} ${hy + 51} ${h + 23} ${hy + 44}`, .55)}
        <rect x={h + 4} y={hy + 28} width="7" height="5" rx="1" fill={paper} stroke={ink} strokeWidth=".7" />
      </g>}
      {sides.map(side => <g key={`hand-${side}`} transform={`scale(${side} 1) translate(${wrist} ${wristY})`}>
        <path d="M -5 -2 L 5 -2 Q 5 5 8 10 L 10 19 Q 10 22 8 21 L 4 13 L 5 29 Q 5 32 3 31 L 1 18 L 1 33 Q 0 35 -1 33 L -3 19 L -3 31 Q -5 34 -6 30 L -7 17 L -7 27 Q -9 29 -10 26 L -11 13 Q -10 7 -5 -2 Z" fill={body.skin} stroke={ink} strokeWidth=".7" strokeOpacity=".55" />
        <path d="M -5 0 Q -9 13 -5 19 L -4 29 L -6 29 L -8 13 Z" fill={ink} opacity=".08" />
        {seam('M -5 7 Q 0 9 2 14 M -4 15 l 3 1 M -3 2 l 5 0', .22, .6)}
      </g>)}
      <g>
        <path d="M -23 58 Q -29 53 -28 65 Q -26 75 -21 72 M 23 58 Q 29 53 28 65 Q 26 75 21 72" fill={body.skin} stroke={ink} strokeOpacity=".5" strokeWidth=".75" />
        <path d="M -23 48 C -23 31 -10 28 1 29 C 20 29 24 40 23 55 L 21 72 Q 17 87 1 94 Q -14 90 -20 76 Z" fill={body.skin} stroke={ink} strokeOpacity=".55" strokeWidth=".8" />
        <path d="M -23 48 C -23 31 -10 28 1 29 C 20 29 24 40 23 55 L 21 72 Q 17 87 1 94 Q -14 90 -20 76 Z" fill={url('skin')} />
        <path d="M -19 66 Q -12 71 -6 69 Q -10 76 -18 73 M 9 69 Q 16 72 21 66 L 18 74 Q 12 76 9 69" fill="#b46e60" opacity=".14" />
        {seam('M -17 55 Q -11 52 -6 55 M 6 55 Q 12 52 17 55', .72, 1.1)}
        <path d="M -17 60 Q -12 56 -6 60 Q -11 63 -17 60 M 6 60 Q 11 56 17 60 Q 12 63 6 60" fill={paper} fillOpacity=".5" stroke={ink} strokeWidth=".7" />
        <ellipse cx="-10.5" cy="59.6" rx="1.5" ry="1.9" fill={ink} /><ellipse cx="11.1" cy="59.6" rx="1.5" ry="1.9" fill={ink} />
        {seam('M 1 59 Q 0 67 -2 71 Q 1 74 4 71 M -15 64 q 4 1 7 0 M 8 64 q 4 1 7 -1', .32, .65)}
        <path d="M -6 80 Q -2 76 1 78 Q 4 77 7 80 Q 1 86 -6 80" fill="#985f56" opacity=".58" />
        {seam('M -6 80 Q 1 81 7 80 M -2 88 Q 1 89 4 87', .42, .6)}
        <path d={body.hair === 'crop' ? 'M -23 64 Q -28 60 -27 43 Q -25 24 -6 23 Q 12 18 23 31 Q 30 41 24 62 L 19 49 Q 16 41 17 35 Q 0 51 -18 48 L -20 65 Z' : 'M -24 68 Q -30 49 -23 36 Q -15 21 3 24 Q 26 23 29 45 L 24 71 L 20 53 Q 19 41 13 35 Q 3 48 -18 51 L -21 70 Z'} fill={url('hair')} stroke={hair} strokeWidth=".85" />
        <path d={body.hair === 'crop' ? 'M -22 41 Q -7 26 13 29 M -17 45 Q 2 41 15 32 M 20 36 Q 25 45 22 53' : 'M -23 44 Q -17 28 5 28 M -17 46 Q 1 41 12 30 M 17 32 Q 26 40 24 57'} fill="none" stroke="#a18a72" strokeOpacity=".35" strokeWidth=".8" />
        {body.hair === 'long' && <path d="M -23 63 Q -27 95 -21 128 Q -28 120 -29 106 L -27 64 M 24 66 Q 21 91 29 118 Q 22 116 19 99 L 21 72" fill={url('hair')} />}
        {body.hair === 'bob' && <path d="M -23 65 Q -24 88 -20 104 L -27 102 L -27 69 M 24 67 L 27 101 L 19 105 Q 24 90 21 74" fill={url('hair')} />}
      </g>
    </g>
  </svg>;
}
