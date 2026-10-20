import { FONT_OPTIONS } from '../engine/fonts';
import { matchPreset, PRESETS, presetPalette } from '../engine/palette';
import { DIRECTION_LABEL, LIMITS, weightSupported } from '../engine/settings';
import type { EffectDef, EffectSettings, FontKey, ParamDef, ParamValue } from '../engine/types';
import { activeParams } from '../state/prompt';
import { ColorField, Icon, RangeField, SelectField, TextField, ToggleField } from './ui';

interface Props {
  def: EffectDef;
  settings: EffectSettings;
  onChange: (p: Partial<EffectSettings>) => void;
  onParam: (key: string, v: ParamValue) => void;
  onReset: () => void;
  onRandom: () => void;
}

export function ControlPanel({ def, settings: s, onChange, onParam, onReset, onRandom }: Props) {
  const c = new Set(def.controls);
  const preset = matchPreset(s);
  const params = activeParams(def, s);
  return (
    <div className="controls">
      {c.has('text') && (
        <fieldset className="group">
          <legend>文字</legend>
          <TextField
            label="自訂文字"
            multiline
            value={s.text}
            maxLength={def.maxChars ?? 40}
            placeholder={def.defaultText}
            onChange={(v) => onChange({ text: v })}
            hint={`${def.textHint ?? '可輸入多行；「／」也可分段。'} 最多 ${def.maxChars ?? 40} 個字，空白時使用預設文字。`}
          />
          {c.has('font') && <SelectField label="字體" value={s.font} options={FONT_OPTIONS} onChange={(v) => onChange({ font: v as FontKey })} />}
          {c.has('weight') &&
            (weightSupported(s.font) ? (
              <RangeField label="字重" value={s.weight} {...LIMITS.weight} onChange={(v) => onChange({ weight: v })} />
            ) : (
              <p className="field-hint">等寬字體只載入 400／700 兩種字重，字重滑桿已隱藏。</p>
            ))}
          {c.has('tracking') && <RangeField label="字距" value={s.tracking} {...LIMITS.tracking} format={(v) => `${v.toFixed(2)}em`} onChange={(v) => onChange({ tracking: v })} />}
        </fieldset>
      )}

      <fieldset className="group">
        <legend>色彩</legend>
        <div className="presets" role="group" aria-label="色彩 presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`preset${preset === p.id ? ' on' : ''}`}
              aria-pressed={preset === p.id}
              title={p.note}
              onClick={() => onChange(presetPalette(p.id))}
            >
              <span className="preset-sw" aria-hidden="true">
                <i style={{ background: p.background }} />
                <i style={{ background: p.primary }} />
                <i style={{ background: p.secondary }} />
                <i style={{ background: p.accent }} />
              </span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="color-grid">
          <ColorField label="Background" value={s.background} onChange={(v) => onChange({ background: v })} />
          <ColorField label="Primary" value={s.primary} onChange={(v) => onChange({ primary: v })} />
          {c.has('secondary') && <ColorField label="Secondary" value={s.secondary} onChange={(v) => onChange({ secondary: v })} />}
          {c.has('accent') && <ColorField label="Accent" value={s.accent} onChange={(v) => onChange({ accent: v })} />}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>動態</legend>
        {c.has('intensity') && <RangeField label="強度" value={s.intensity} {...LIMITS.intensity} format={(v) => `${v.toFixed(2)}`} onChange={(v) => onChange({ intensity: v })} />}
        {c.has('scale') && <RangeField label="尺度" value={s.scale} {...LIMITS.scale} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => onChange({ scale: v })} />}
        {c.has('direction') && def.directions && def.directions.length > 1 && (
          <div className="field">
            <span className="field-label" id={`dir-${def.id}`}>
              方向
            </span>
            <div className="seg" role="group" aria-labelledby={`dir-${def.id}`}>
              {def.directions.map((d) => (
                <button key={d} type="button" className={s.direction === d ? 'on' : ''} aria-pressed={s.direction === d} onClick={() => onChange({ direction: d })}>
                  {DIRECTION_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}
        {c.has('seed') && <RangeField label="Seed（隨機種子）" value={s.seed} {...LIMITS.seed} onChange={(v) => onChange({ seed: v })} />}
      </fieldset>

      {params.length > 0 && (
        <fieldset className="group">
          <legend>效果參數</legend>
          {params.map((p) => (
            <ParamField key={p.key} p={p} value={s.params[p.key]} onChange={(v) => onParam(p.key, v)} />
          ))}
        </fieldset>
      )}

      <div className="panel-actions">
        <button type="button" className="btn" onClick={onRandom} title="以新的 seed 產生參數；同一個 seed 永遠得到相同結果">
          <Icon name="dice" size={16} /> 隨機（可重現）
        </button>
        <button type="button" className="btn" onClick={onReset}>
          <Icon name="reset" size={16} /> 恢復預設
        </button>
      </div>
    </div>
  );
}

function ParamField({ p, value, onChange }: { p: ParamDef; value: ParamValue | undefined; onChange: (v: ParamValue) => void }) {
  switch (p.type) {
    case 'range':
      return (
        <RangeField
          label={p.label}
          value={typeof value === 'number' ? value : p.default}
          min={p.min}
          max={p.max}
          step={p.step}
          hint={p.hint}
          format={(v) => `${+v.toFixed(3)}${p.unit ?? ''}`}
          onChange={onChange}
        />
      );
    case 'toggle':
      return <ToggleField label={p.label} checked={typeof value === 'boolean' ? value : p.default} hint={p.hint} onChange={onChange} />;
    case 'select':
      return <SelectField label={p.label} value={typeof value === 'string' ? value : p.default} options={p.options} hint={p.hint} onChange={onChange} />;
    case 'text':
      return <TextField label={p.label} value={typeof value === 'string' ? value : p.default} maxLength={p.maxLength} hint={p.hint} onChange={onChange} />;
  }
}
