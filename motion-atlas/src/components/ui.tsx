import { useId, type ReactNode } from 'react';

type IconName =
  | 'play' | 'pause' | 'replay' | 'loop' | 'heart' | 'heartFill' | 'shuffle' | 'search' | 'close'
  | 'left' | 'right' | 'back' | 'link' | 'camera' | 'download' | 'upload' | 'reset' | 'sliders' | 'video'
  | 'copy' | 'dice' | 'sun' | 'moon' | 'frame' | 'eye' | 'eyeOff' | 'stop' | 'sparkle';

const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></>,
  replay: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></>,
  loop: <><path d="M17 3l3 3-3 3" /><path d="M20 6H8a4 4 0 0 0-4 4v1" /><path d="M7 21l-3-3 3-3" /><path d="M4 18h12a4 4 0 0 0 4-4v-1" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />,
  heartFill: <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" fill="currentColor" />,
  shuffle: <><path d="M16 4h4v4" /><path d="M4 20 20 4" /><path d="M20 16v4h-4" /><path d="M15 15l5 5" /><path d="M4 4l5 5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  back: <><path d="M10 6l-6 6 6 6" /><path d="M4 12h16" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  download: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>,
  upload: <><path d="M12 20V9" /><path d="m7 14 5-5 5 5" /><path d="M5 4h14" /></>,
  reset: <><path d="M4 12a8 8 0 1 0 8-8" /><path d="M4 4v5h5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  frame: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><rect x="8" y="15" width="8" height="2" rx="1" fill="currentColor" stroke="none" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.4 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  sparkle: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export function RangeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  const { label, value, min, max, step, onChange, format, hint } = props;
  const shown = format ? format(value) : String(+value.toFixed(2));
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="field range-field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{shown}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        aria-valuetext={shown}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field color-field">
      <label htmlFor={id}>
        <span className="swatch" style={{ background: value }} aria-hidden="true" />
        <span className="color-label">{label}</span>
        <code>{value.toUpperCase()}</code>
      </label>
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.currentTarget.value.toUpperCase())} />
    </div>
  );
}

export function ToggleField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="field toggle-field">
      <label htmlFor={id} className="toggle">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
        <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
        <span>{label}</span>
      </label>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function SelectField(props: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="field select-field">
      <label htmlFor={id}>{props.label}</label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {props.hint && <p className="field-hint">{props.hint}</p>}
    </div>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; maxLength: number; hint?: string; multiline?: boolean; placeholder?: string }) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="field text-field">
      <label htmlFor={id}>{props.label}</label>
      {props.multiline ? (
        <textarea
          id={id}
          rows={3}
          value={props.value}
          placeholder={props.placeholder}
          maxLength={props.maxLength * 4}
          aria-describedby={props.hint ? hintId : undefined}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      ) : (
        <input id={id} type="text" value={props.value} placeholder={props.placeholder} maxLength={props.maxLength * 4} aria-describedby={props.hint ? hintId : undefined} onChange={(e) => props.onChange(e.currentTarget.value)} />
      )}
      {props.hint && <p id={hintId} className="field-hint">{props.hint}</p>}
    </div>
  );
}
