import { useRef } from 'react';
import { PALETTE } from '../engine/helpers';
import { LIMITS } from '../engine/settings';
import { graphemeCount } from '../engine/text';
import type { EffectDef, EffectSettings, ParamValue } from '../engine/types';
import { ColorField, Icon, RangeField, SelectField, TextField, ToggleField } from './ui';

const PRESETS: { name: string; p: (typeof PALETTE)[keyof typeof PALETTE] }[] = [
  { name: '夜色螢光', p: PALETTE.darkLime },
  { name: '夜色珊瑚', p: PALETTE.darkCoral },
  { name: '米白墨黑', p: PALETTE.paperInk },
  { name: '米白紫', p: PALETTE.paperViolet },
  { name: '螢光黃綠', p: PALETTE.lime },
  { name: '珊瑚橘', p: PALETTE.coral },
  { name: '紫色', p: PALETTE.violet },
  { name: '青綠', p: PALETTE.teal },
];

interface Props {
  def: EffectDef;
  settings: EffectSettings;
  onChange: (patch: Partial<EffectSettings>) => void;
  onParam: (key: string, v: ParamValue) => void;
  onReset: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  importMessage: string | null;
}

export function ControlPanel({ def, settings: s, onChange, onParam, onReset, onExportJSON, onImportJSON, importMessage }: Props) {
  const hide = new Set(def.hide ?? []);
  const max = def.maxChars ?? 40;
  const count = graphemeCount(s.text);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel-inner">
      {!hide.has('text') && (
        <section className="panel-sec">
          <h2 className="panel-h">文字</h2>
          <div className="field text-area-field">
            <div className="field-row">
              <label htmlFor="effect-text">自訂文字</label>
              <span className={`counter${count >= max ? ' warn' : ''}`}>
                {count} / {max}
              </span>
            </div>
            <textarea
              id="effect-text"
              rows={2}
              value={s.text}
              onChange={(e) => onChange({ text: e.currentTarget.value })}
              aria-describedby="effect-text-hint"
              spellCheck={false}
            />
            <p className="field-hint" id="effect-text-hint">
              {def.textHint ? def.textHint + ' ' : ''}支援繁中、英文、數字、標點與換行；最多 {max} 字，超過會截斷。空白時顯示預設文字「{def.defaultText}」。
            </p>
          </div>
        </section>
      )}

      <section className="panel-sec">
        <h2 className="panel-h">顏色</h2>
        <div className="color-grid">
          <ColorField label="主色" value={s.primary} onChange={(v) => onChange({ primary: v })} />
          {!hide.has('secondary') && <ColorField label="次色" value={s.secondary} onChange={(v) => onChange({ secondary: v })} />}
          <ColorField label="背景" value={s.background} onChange={(v) => onChange({ background: v })} />
        </div>
        <div className="presets" role="group" aria-label="配色組合">
          {PRESETS.map(({ name, p }) => (
            <button
              key={name}
              type="button"
              className="preset"
              title={name}
              aria-label={`套用配色：${name}`}
              onClick={() => onChange({ primary: p.primary, secondary: p.secondary, background: p.background })}
              style={{ background: p.background }}
            >
              <span style={{ background: p.primary }} />
              <span style={{ background: p.secondary }} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel-sec">
        <h2 className="panel-h">版面與動態</h2>
        {!hide.has('fontScale') && (
          <RangeField label="字體大小" {...LIMITS.fontScale} value={s.fontScale} onChange={(v) => onChange({ fontScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )}
        {!hide.has('tracking') && (
          <RangeField label="字距" {...LIMITS.tracking} value={s.tracking} onChange={(v) => onChange({ tracking: v })} format={(v) => `${v.toFixed(2)} em`} />
        )}
        <RangeField label="速度" {...LIMITS.speed} value={s.speed} onChange={(v) => onChange({ speed: v })} format={(v) => `${v.toFixed(2)}×`} />
        {!hide.has('intensity') && (
          <RangeField label="動作強度" {...LIMITS.intensity} value={s.intensity} onChange={(v) => onChange({ intensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )}
      </section>

      {def.params && def.params.length > 0 && (
        <section className="panel-sec">
          <h2 className="panel-h">效果參數</h2>
          {def.params.map((p) => {
            const v = s.params[p.key];
            switch (p.type) {
              case 'range':
                return (
                  <RangeField
                    key={p.key}
                    label={p.label}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={typeof v === 'number' ? v : p.default}
                    hint={p.hint}
                    format={(x) => `${+x.toFixed(2)}${p.unit ?? ''}`}
                    onChange={(x) => onParam(p.key, x)}
                  />
                );
              case 'toggle':
                return <ToggleField key={p.key} label={p.label} hint={p.hint} checked={typeof v === 'boolean' ? v : p.default} onChange={(x) => onParam(p.key, x)} />;
              case 'select':
                return <SelectField key={p.key} label={p.label} hint={p.hint} value={typeof v === 'string' ? v : p.default} options={p.options} onChange={(x) => onParam(p.key, x)} />;
              case 'text':
                return <TextField key={p.key} label={p.label} hint={p.hint} maxLength={p.maxLength} value={typeof v === 'string' ? v : p.default} onChange={(x) => onParam(p.key, x)} />;
            }
          })}
        </section>
      )}

      <section className="panel-sec panel-actions">
        <button type="button" className="btn" onClick={onReset}>
          <Icon name="reset" /> 恢復預設
        </button>
        <button type="button" className="btn" onClick={onExportJSON}>
          <Icon name="download" /> 匯出設定 JSON
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" /> 匯入設定 JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) onImportJSON(file);
            e.currentTarget.value = '';
          }}
        />
        {importMessage && (
          <p className="field-hint" role="status">
            {importMessage}
          </p>
        )}
      </section>
    </div>
  );
}
