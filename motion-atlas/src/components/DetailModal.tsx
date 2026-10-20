import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_MAP, DIFFICULTY_LABEL, RENDERER_LABEL, SOURCE_LABEL } from '../effects/categories';
import { Player, type PlayerState } from '../engine/player';
import { hasQuerySettings, LIMITS, normalizeSettings, randomizeSettings, RATIO_VALUE, RATIOS, settingsFromQuery, settingsToQuery } from '../engine/settings';
import type { EffectDef, EffectSettings, ParamValue } from '../engine/types';
import { capturePNG, downloadBlob, recordWebM, webmSupported } from '../state/exporter';
import { buildPrompt, settingsJSON, type PromptKind } from '../state/prompt';
import { readJSON, removeKey, writeJSON } from '../state/storage';
import { getGlobalPause, isLowPower, replaceQuery, setPref, toggleFavorite, useFavorites, useGlobalPause, usePrefs, useReducedMotion } from '../state/store';
import { ControlPanel } from './ControlPanel';
import { pad3 } from './EffectCard';
import { SafeArea } from './SafeArea';
import { Icon, RangeField, ToggleField } from './ui';

const storeKey = (id: string) => `ma:settings:${id}`;

function initialSettings(def: EffectDef, query: URLSearchParams): EffectSettings {
  if (hasQuerySettings(query)) return settingsFromQuery(def, query);
  const saved = readJSON<unknown>(storeKey(def.id), null);
  if (saved && typeof saved === 'object') return normalizeSettings(def, saved);
  return { ...def.defaultSettings, params: { ...def.defaultSettings.params } };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface Props {
  def: EffectDef;
  query: URLSearchParams;
  prev: EffectDef;
  next: EffectDef;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function DetailModal({ def, query, prev, next, onClose, onNavigate }: Props) {
  const reduced = useReducedMotion();
  const favs = useFavorites();
  const prefs = usePrefs();
  const paused = useGlobalPause();
  const fav = favs.includes(def.id);
  const [settings, setSettings] = useState<EffectSettings>(() => initialSettings(def, query));
  const [ps, setPs] = useState<PlayerState | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualText, setManualText] = useState<{ title: string; text: string } | null>(null);
  const [transparent, setTransparent] = useState(false);
  const [guidesInExport, setGuidesInExport] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const playerRef = useRef<Player | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cat = CATEGORY_MAP[def.category];
  const cap = def.capabilities;

  // ---- player lifecycle (one Player per opened effect) ----
  useEffect(() => {
    const stage = stageRef.current!;
    const p = new Player(stage, def, settingsRef.current, {
      mode: 'detail',
      autoplay: !getGlobalPause(),
      reducedMotion: reduced,
      lowPower: isLowPower(),
      onState: setPs,
    });
    playerRef.current = p;
    (window as unknown as { __maPlayer?: Player }).__maPlayer = p;
    const ro = new ResizeObserver(() => setStageSize({ w: stage.clientWidth, h: stage.clientHeight }));
    ro.observe(stage);
    return () => {
      ro.disconnect();
      p.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id]);

  useEffect(() => {
    if (paused) playerRef.current?.pause();
  }, [paused]);

  // push settings into the player (text edits debounced) + URL + storage
  const textTimer = useRef(0);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) firstRun.current = false;
    else {
      const p = playerRef.current;
      window.clearTimeout(textTimer.current);
      if (p && p.settings.text !== settings.text) textTimer.current = window.setTimeout(() => p.update(settingsRef.current), 220);
      else p?.update(settings);
    }
    replaceQuery(`/e/${def.id}`, settingsToQuery(def, settings, def.defaultSettings));
    const t = window.setTimeout(() => writeJSON(storeKey(def.id), settings), 300);
    return () => window.clearTimeout(t);
  }, [settings, def]);

  useLayoutEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    document.title = `${def.code} ${def.nameZh} ${def.nameEn} — MOTION ATLAS`;
    return () => {
      document.title = 'MOTION ATLAS 動效圖鑑';
    };
  }, [def]);

  const flash = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 2600);
  }, []);

  const patch = useCallback((p: Partial<EffectSettings>) => setSettings((s) => ({ ...s, ...p })), []);
  const setParam = useCallback((key: string, v: ParamValue) => setSettings((s) => ({ ...s, params: { ...s.params, [key]: v } })), []);

  const reset = () => {
    removeKey(storeKey(def.id));
    setSettings({ ...def.defaultSettings, params: { ...def.defaultSettings.params } });
    flash('已恢復預設設定');
  };
  const random = () => {
    const seed = 1 + Math.floor(Math.random() * 9998);
    setSettings((s) => randomizeSettings(def, s, seed));
    flash(`已套用 seed ${seed} 的參數（同一 seed 可重現）`);
  };

  const copyOrShow = async (title: string, text: string, okMsg: string) => {
    if (await copyText(text)) {
      flash(okMsg);
      setManualText(null);
    } else {
      flash('無法存取剪貼簿，請在下方文字框手動選取複製', 'err');
      setManualText({ title, text });
    }
  };

  const shareUrl = () => {
    const q = settingsToQuery(def, settings, def.defaultSettings).toString();
    return `${location.origin}${location.pathname}#/e/${def.id}${q ? '?' + q : ''}`;
  };

  const copyPrompt = (kind: PromptKind) =>
    copyOrShow(kind === 'standalone' ? 'AI 製作 prompt（獨立實作）' : 'AI 製作 prompt（整合到既有網站）', buildPrompt(def, settings, kind), '已複製 AI 製作 prompt');

  const exportPNG = async () => {
    const p = playerRef.current;
    if (!p) return;
    setBusy('png');
    const r = await capturePNG(p, def, { transparent, guides: guidesInExport, guideOpacity: prefs.safeOpacity });
    setBusy(null);
    if (r.blob) {
      downloadBlob(r.blob, `${def.code}-${def.id}.png`);
      flash(r.note ? `已輸出 PNG。${r.note}` : '已輸出 PNG');
    } else flash(r.error ?? '截圖失敗', 'err');
  };

  const mime = webmSupported(def);
  const exportWebM = async () => {
    const p = playerRef.current;
    if (!p || busy) return;
    setBusy('webm');
    const secs = Math.min(10, Math.max(3, (def.cycle ?? 5) / settings.speed));
    flash(`錄製中（${secs.toFixed(1)} 秒，請保持此分頁開啟）`);
    const blob = await recordWebM(p, def, secs);
    setBusy(null);
    if (blob) downloadBlob(blob, `${def.code}-${def.id}.webm`);
    else flash('錄製失敗：此瀏覽器不支援 canvas WebM 錄製', 'err');
  };

  const exportJSON = () => {
    downloadBlob(new Blob([JSON.stringify(settingsJSON(def, settings), null, 2)], { type: 'application/json' }), `${def.id}-settings.json`);
  };
  const importJSON = async (file: File) => {
    try {
      if (file.size > 64 * 1024) throw new Error('too big');
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object') throw new Error('bad');
      // accept both the exported shape (colors / params nested) and a flat settings object
      const flat = { ...data, ...(data.colors && typeof data.colors === 'object' ? data.colors : {}), tracking: data.trackingEm ?? data.tracking };
      setSettings((s) => normalizeSettings(def, flat, s));
      setImportMsg(data.effect && data.effect !== def.id ? `已匯入（來自效果「${String(data.effect).slice(0, 40)}」，不適用的值已忽略）` : '已匯入設定');
    } catch {
      setImportMsg('無法讀取這個 JSON 檔案（格式錯誤或超過 64KB）');
    }
  };

  // keyboard: shortcuts + focus trap + Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') {
        if (manualText) setManualText(null);
        else onClose();
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (n) => n.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('input, textarea, select, button, a, [contenteditable]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if (e.key === 'r' || e.key === 'R') playerRef.current?.restart();
      else if (e.key === 'ArrowLeft') onNavigate(prev.id);
      else if (e.key === 'ArrowRight') onNavigate(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev.id, next.id, onClose, onNavigate, manualText]);

  const ar = RATIO_VALUE[settings.ratio];
  const playing = !!ps?.playing;
  const text = settings.text.trim() || def.defaultText;
  const a11yText = useMemo(() => `${def.nameZh}動畫${def.controls.includes('text') ? `，文字內容：${text.replace(/[／\n]+/g, '、')}` : ''}。${def.description}`, [def, text]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" style={{ ['--cat' as string]: cat.color }}>
        <header className="modal-head">
          <div className="modal-title-wrap">
            <div className="detail-meta">
              <span className="detail-code">{def.code}</span>
              <span className="muted">No.{pad3(def.displayNumber)}</span>
              <span className="card-cat">{cat.label}</span>
              <span className="tag">{SOURCE_LABEL[def.sourceType]}</span>
            </div>
            <h2 id="detail-title" ref={titleRef} tabIndex={-1} className="detail-title">
              {def.nameZh} <span className="detail-en">{def.nameEn}</span>
            </h2>
          </div>
          <div className="modal-nav">
            <button type="button" className="btn btn-sm" onClick={() => onNavigate(prev.id)} aria-label={`上一個：${prev.nameZh}`}>
              <Icon name="left" size={16} /> <span className="hide-sm">上一個</span>
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onNavigate(next.id)} aria-label={`下一個：${next.nameZh}`}>
              <span className="hide-sm">下一個</span> <Icon name="right" size={16} />
            </button>
            <button type="button" className={`btn btn-sm btn-icon${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={fav ? '取消收藏' : '收藏'} onClick={() => toggleFavorite(def.id)}>
              <Icon name={fav ? 'heartFill' : 'heart'} size={16} />
            </button>
            <button type="button" className="btn btn-sm btn-icon" aria-label="關閉詳情" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </header>

        <div className="modal-body">
          <section className="detail-left" aria-label="預覽">
            <div className={`stage-frame ratio-${settings.ratio.replace(':', 'x')}`}>
              <div className="stage-box" style={{ aspectRatio: String(ar) }}>
                <div ref={stageRef} className="detail-stage" role="img" aria-label={a11yText} />
                {prefs.safeArea && <SafeArea w={stageSize.w} h={stageSize.h} opacity={prefs.safeOpacity} />}
              </div>
            </div>
            <p className="sr-only">{a11yText}</p>
            {ps?.error && (
              <p className="stage-note error" role="alert">
                {ps.error}
              </p>
            )}
            {ps?.notice && <p className="stage-note">{ps.notice}</p>}
            {reduced && !playing && ps?.ready && <p className="stage-note">已偵測到「減少動態」偏好：預設顯示靜態畫面，按「播放」即可觀看。</p>}
            {def.interactive && <p className="stage-note subtle">互動效果：在舞台上移動滑鼠或以手指拖曳；閒置時自動示範。</p>}

            <div className="transport" role="toolbar" aria-label="播放控制">
              <button type="button" className="btn btn-primary" onClick={() => playerRef.current?.toggle()} disabled={!ps?.ready}>
                <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? '暫停' : '播放'}
              </button>
              <button type="button" className="btn" onClick={() => playerRef.current?.restart()} disabled={!ps?.ready}>
                <Icon name="replay" size={16} /> 重播
              </button>
              {def.loopable && (
                <button type="button" className={`btn${settings.loop ? ' is-on' : ''}`} aria-pressed={settings.loop} onClick={() => patch({ loop: !settings.loop })}>
                  <Icon name="loop" size={16} /> 循環
                </button>
              )}
              <div className="seg" role="group" aria-label="舞台比例">
                {RATIOS.map((r) => (
                  <button key={r} type="button" className={settings.ratio === r ? 'on' : ''} aria-pressed={settings.ratio === r} onClick={() => patch({ ratio: r })}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="transport-speed">
                <RangeField label="速度" value={settings.speed} {...LIMITS.speed} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => patch({ speed: v })} />
              </div>
            </div>

            <div className="safe-row">
              <ToggleField label="安全區預覽" checked={prefs.safeArea} onChange={(v) => setPref('safeArea', v)} hint="構圖輔助：動作／標題安全區、字幕區與中央主體輪廓。" />
              {prefs.safeArea && (
                <RangeField label="輔助線透明度" value={prefs.safeOpacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setPref('safeOpacity', v)} />
              )}
            </div>

            <section className="export-box" aria-labelledby="export-h">
              <h3 id="export-h">分享與匯出</h3>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => copyOrShow('分享連結', shareUrl(), '已複製分享連結（含目前設定）')}>
                  <Icon name="link" size={16} /> 複製分享連結
                </button>
                {cap.png && (
                  <button type="button" className="btn" onClick={exportPNG} disabled={!!busy || !ps?.ready}>
                    <Icon name="camera" size={16} /> {busy === 'png' ? '輸出中…' : '截取 PNG'}
                  </button>
                )}
                {mime && (
                  <button type="button" className="btn" onClick={exportWebM} disabled={!!busy || !ps?.ready}>
                    <Icon name="video" size={16} /> {busy === 'webm' ? '錄製中…' : '錄製 WebM'}
                  </button>
                )}
                <button type="button" className="btn" onClick={exportJSON}>
                  <Icon name="download" size={16} /> 匯出設定 JSON
                </button>
                <label className="btn file-btn">
                  <Icon name="upload" size={16} /> 匯入 JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) void importJSON(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              {cap.png && (
                <div className="export-opts">
                  {cap.transparentPng && <ToggleField label="透明背景" checked={transparent} onChange={setTransparent} />}
                  <ToggleField label="PNG 包含安全區輔助線" checked={guidesInExport} onChange={setGuidesInExport} />
                </div>
              )}
              <p className="field-hint">
                {cap.png === 'canvas' && '截取目前 Canvas 畫面（實際播放中的這一幀）。'}
                {cap.png === 'svg' && '序列化目前 SVG 後轉成 PNG；網頁字體在轉換時無法使用，文字會以系統字體呈現。'}
                {cap.png === 'dom' && 'DOM 效果以 SVG foreignObject 實驗性截取：網頁字體、濾鏡與部分 CSS 可能無法完整保留。'}
                {!cap.png && 'CSS 3D 效果不支援 PNG 截取（瀏覽器無法可靠地把 preserve-3d 轉成圖片）。'}
                {mime ? ' WebM 會從 Canvas 即時錄製一個循環。' : cap.webm ? ' 此瀏覽器不支援 WebM 錄製。' : ''}
              </p>
              {importMsg && (
                <p className="field-hint" role="status">
                  {importMsg}
                </p>
              )}
            </section>

            <section className="info" aria-label="效果說明">
              <p className="detail-desc">{def.description}</p>
              <div className="info-grid">
                <div>
                  <h3>適用場景</h3>
                  <ul className="chips-static">
                    {def.suitable.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>技術</h3>
                  <ul className="chips-static">
                    <li>{RENDERER_LABEL[def.renderer]}</li>
                    <li>{DIFFICULTY_LABEL[def.difficulty]}</li>
                    {def.tags.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h3>技術原理</h3>
              <p>{def.principle}</p>
              <h3>動態結構</h3>
              <dl className="recipe">
                <dt>入場</dt>
                <dd>{def.recipe.enter}</dd>
                <dt>運動</dt>
                <dd>{def.recipe.motion}</dd>
                <dt>停留</dt>
                <dd>{def.recipe.hold}</dd>
                <dt>離場</dt>
                <dd>{def.recipe.exit}</dd>
                <dt>循環</dt>
                <dd>{def.recipe.loop}</dd>
              </dl>
              <h3>驗收條件</h3>
              <ul className="accept">
                {def.accept.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {def.limits?.length ? (
                <>
                  <h3>已知限制</h3>
                  <ul className="accept">
                    {def.limits.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="field-hint">
                來源類型：{SOURCE_LABEL[def.sourceType]}
                {def.sourceType !== 'original' ? '（依參考截圖的名稱與畫面重建，非原站原始碼）' : ''}
                {def.legacyIds?.length ? `。合併自舊文字庫：${def.legacyIds.join('、')}` : ''}
              </p>
            </section>
          </section>

          <aside className="detail-right" aria-label="參數面板">
            <section className="prompt-box" aria-labelledby="prompt-h">
              <h3 id="prompt-h">
                <Icon name="sparkle" size={16} /> 複製 AI 製作 prompt
              </h3>
              <p className="field-hint">依目前設定即時產生，包含運動機制、色彩 token、比例、參數 JSON 與驗收條件。</p>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => copyPrompt('standalone')}>
                  <Icon name="copy" size={16} /> 獨立實作
                </button>
                <button type="button" className="btn" onClick={() => copyPrompt('integrate')}>
                  <Icon name="copy" size={16} /> 整合到既有網站
                </button>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => setManualText(manualText ? null : { title: 'AI 製作 prompt（獨立實作）', text: buildPrompt(def, settings, 'standalone') })}
              >
                {manualText ? '隱藏文字' : '顯示 prompt 文字'}
              </button>
              {manualText && (
                <div className="manual-copy">
                  <label htmlFor="manual-copy-ta">{manualText.title}（可全選複製）</label>
                  <textarea id="manual-copy-ta" readOnly value={manualText.text} rows={10} onFocus={(e) => e.currentTarget.select()} />
                </div>
              )}
            </section>
            <ControlPanel def={def} settings={settings} onChange={patch} onParam={setParam} onReset={reset} onRandom={random} />
          </aside>
        </div>

        <div className={`toast${toast ? ' show' : ''}${toast?.kind === 'err' ? ' err' : ''}`} role="status" aria-live="polite">
          {toast?.msg}
        </div>
      </div>
    </div>
  );
}
