type Props = { build: number; shoulderHip: number; waist: number; compact?: boolean };

export default function BodySilhouette({ build, shoulderHip, waist, compact = false }: Props) {
  const breadth = 22 + (build - 1) * 8;
  const shoulders = breadth + shoulderHip * 5;
  const hips = breadth - shoulderHip * 5;
  const middle = Math.min(shoulders, hips) * (0.9 - waist * 0.14);
  const outline = `M 88 54 Q 83 62 ${100 - shoulders} 65
    Q ${91 - shoulders} 82 ${86 - shoulders} 126
    Q ${83 - shoulders} 150 ${88 - shoulders} 153
    Q ${94 - shoulders} 155 ${98 - shoulders} 132
    L ${100 - shoulders + 7} 91 Q ${100 - middle} 104 ${100 - middle} 119
    Q ${100 - hips} 141 ${100 - hips} 153
    Q ${100 - hips + 2} 184 83 226 L 82 251
    Q 78 258 83 260 L 96 260 L 98 224 L 100 168
    L 102 224 L 104 260 L 117 260
    Q 122 258 118 251 L 117 226
    Q ${100 + hips - 2} 184 ${100 + hips} 153
    Q ${100 + hips} 141 ${100 + middle} 119
    Q ${100 + middle} 104 ${100 + shoulders - 7} 91
    L ${102 + shoulders} 132 Q ${106 + shoulders} 155 ${112 + shoulders} 153
    Q ${117 + shoulders} 150 ${114 + shoulders} 126
    Q ${109 + shoulders} 82 ${100 + shoulders} 65
    Q 117 62 112 54 Z`;
  return <svg className={`body-silhouette${compact ? ' body-silhouette-small' : ''}`} viewBox="35 8 130 260" aria-hidden="true" focusable="false">
    {!compact && <g className="body-guides"><path d="M 22 76 H 178 M 22 119 H 178 M 22 151 H 178" /><path d="M 100 12 V 270" /></g>}
    <ellipse cx="100" cy="32" rx="15" ry="20" />
    <path d={outline} />
  </svg>;
}
