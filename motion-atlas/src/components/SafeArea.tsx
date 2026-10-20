import { guideShapes } from '../state/exporter';

/** Composition aid drawn over the stage (never part of the effect or the export unless asked). */
export function SafeArea({ w, h, opacity }: { w: number; h: number; opacity: number }) {
  if (w < 4 || h < 4) return null;
  const s = guideShapes(w, h);
  const m = Math.min(w, h);
  const dash = `${m * 0.012} ${m * 0.008}`;
  const fs = Math.max(9, m * 0.026);
  return (
    <svg className="safe-area" viewBox={`0 0 ${w} ${h}`} style={{ opacity }} aria-hidden="true">
      <rect x={s.action.x} y={s.action.y} width={s.action.w} height={s.action.h} fill="none" stroke="#00E0FF" strokeDasharray={dash} strokeWidth={1.5} />
      <rect x={s.title.x} y={s.title.y} width={s.title.w} height={s.title.h} fill="none" stroke="#FFE35A" strokeDasharray={dash} strokeWidth={1.5} />
      <rect x={s.sub.x} y={s.sub.y} width={s.sub.w} height={s.sub.h} fill="rgba(237,88,154,0.18)" stroke="#ED589A" strokeWidth={1.5} />
      <path
        d={`M${s.body.cx - s.body.w / 2},${s.body.bottom} Q${s.body.cx - s.body.w / 2},${s.body.top} ${s.body.cx},${s.body.top} Q${s.body.cx + s.body.w / 2},${s.body.top} ${s.body.cx + s.body.w / 2},${s.body.bottom}`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.5}
      />
      <circle cx={s.head.cx} cy={s.head.cy} r={s.head.r} fill="none" stroke="#fff" strokeWidth={1.5} />
      <g fontSize={fs} fontFamily="system-ui, sans-serif" fontWeight={700}>
        <text x={s.action.x + 4} y={s.action.y + fs + 2} fill="#00E0FF">
          動作安全區 90%
        </text>
        <text x={s.title.x + 4} y={s.title.y + fs + 2} fill="#FFE35A">
          標題安全區 80%
        </text>
        <text x={s.sub.x + 4} y={s.sub.y + fs + 2} fill="#ED589A">
          字幕區
        </text>
        <text x={s.head.cx} y={s.head.cy + s.head.r + fs * 1.3} fill="#fff" textAnchor="middle">
          主體佔位
        </text>
      </g>
    </svg>
  );
}
