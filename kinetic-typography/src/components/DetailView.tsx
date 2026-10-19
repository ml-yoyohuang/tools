import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_MAP, DIFFICULTY_LABEL, RENDERER_LABEL } from '../effects/catalog';
import { EFFECTS, neighbours } from '../effects/registry';
import { Player, type PlayerState } from '../engine/player';
import { defaultSettings, hasQuerySettings, normalizeSettings, RATIO_VALUE, RATIOS, settingsFromQuery, settingsToQuery } from '../engine/settings';
import type { EffectDef, EffectSettings, ParamValue } from '../engine/types';
import { readJSON, removeKey, writeJSON } from '../state/storage';
import { isLowPower, navigate, replaceQuery, toggleFavorite, useFavorites, useReducedMotion } from '../state/store';
import { ControlPanel } from './ControlPanel';
import { pad2 } from './EffectCard';
import { listMemory, randomEffectId } from './ListView';
import { Icon } from './ui';

const storeKey = (id: string) => `kt:settings:${id}`;

function initialSettings(def: EffectDef, query: URLSearchParams): EffectSettings {
  if (hasQuerySettings(query)) return settingsFromQuery(def, query);
  const saved = readJSON<unknown>(storeKey(def.id), null);
  if (saved && typeof saved === 'object') return normalizeSettings(def, saved as Partial<EffectSettings>);
  return defaultSettings(def);
}

export function DetailView({ def, query }: { def: EffectDef; query: URLSearchParams }) {
  const reduced = useReducedMotion();
  const favs = useFavorites();
  const fav = favs.includes(def.id);
  const [settings, setSettings] = useState<EffectSettings>(() => initialSettings(def, query));
  const [ps, setPs] = useState<PlayerState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { prev, next } = neighbours(def.id);
  const cat = CATEGORY_MAP[def.category];

  // ---- player lifecycle ----
  useEffect(() => {
    const stage = stageRef.current!;
    const p = new Player(stage, def, settingsRef.current, {
      mode: 'detail',
      autoplay: true,
      reducedMotion: reduced,
      lowPower: isLowPower(),
      onState: setPs,
    });
    playerRef.current = p;
    (window as unknown as { __ktPlayer?: Player }).__ktPlayer = p;
    return () => {
      p.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id]);

  // push settings into the player (text edits debounced) + URL + storage
  const textTimer = useRef(0);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
    } else {
      const p = playerRef.current;
      window.clearTimeout(textTimer.current);
      const prevText = p?.settings.text;
      if (p && prevText !== settings.text) textTimer.current = window.setTimeout(() => p.update(settingsRef.current), 220);
      else p?.update(settings);
    }
    replaceQuery(`/e/${def.id}`, settingsToQuery(def, settings));
    const t = window.setTimeout(() => writeJSON(storeKey(def.id), settings), 300);
    return () => window.clearTimeout(t);
  }, [settings, def]);

  useEffect(() => {
    listMemory.lastId = def.id;
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.title = `${pad2(def.number)} ${def.nameZh} ${def.nameEn} — TYPE / MOTION LAB`;
    return () => {
      document.title = 'TYPE / MOTION LAB 文字動態實驗室';
    };
  }, [def]);

  const patch = useCallback((p: Partial<EffectSettings>) => setSettings((s) => ({ ...s, ...p })), []);
  const setParam = useCallback((key: string, v: ParamValue) => setSettings((s) => ({ ...s, params: { ...s.params, [key]: v } })), []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  };

  const reset = () => {
    removeKey(storeKey(def.id));
    setSettings(defaultSettings(def));
    playerRef.current?.restart();
    flash('已恢復預設設定');
  };

  const share = async () => {
    const q = settingsToQuery(def, settings).toString();
    const url = `${location.origin}${location.pathname}#/e/${def.id}${q ? '?' + q : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      flash('已複製分享連結');
    } catch {
      window.prompt('複製這個連結：', url);
    }
  };

  const download = (href: string, name: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const capture = () => {
    const url = playerRef.current?.capturePNG();
    if (url) download(url, `${pad2(def.number)}-${def.id}.png`);
    else flash('這個效果目前無法截圖');
  };

  const canRecord = typeof MediaRecorder !== 'undefined' && !!ps?.canCapture && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const record = async () => {
    const p = playerRef.current;
    const canvas = p?.captureCanvas;
    if (!p || !canvas || recording) return;
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return flash('此瀏覽器不支援 WebM 錄製');
    setRecording(true);
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    p.restart();
    rec.start();
    await new Promise((r) => setTimeout(r, 5000));
    rec.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
    download(url, `${pad2(def.number)}-${def.id}.webm`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setRecording(false);
  };

  const exportJSON = () => {
    const data = { effect: def.id, version: 1, settings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    download(url, `${def.id}-settings.json`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const importJSON = async (file: File) => {
    try {
      if (file.size > 64 * 1024) throw new Error('too big');
      const data = JSON.parse(await file.text());
      const src = data && typeof data === 'object' && 'settings' in data ? data.settings : data;
      if (!src || typeof src !== 'object') throw new Error('bad');
      setSettings(normalizeSettings(def, src));
      setImportMsg(data.effect && data.effect !== def.id ? `已匯入（設定來自效果「${data.effect}」，已依本效果的範圍校正）` : '已匯入設定');
    } catch {
      setImportMsg('無法讀取這個 JSON 檔案');
    }
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('input, textarea, select, button, a, [contenteditable], .kt-ui')) return;
      if (e.key === ' ') {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if (e.key === 'r' || e.key === 'R') playerRef.current?.restart();
      else if (e.key === 'ArrowLeft') navigate(`#/e/${prev.id}`);
      else if (e.key === 'ArrowRight') navigate(`#/e/${next.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev.id, next.id]);

  const related = useMemo(
    () =>
      EFFECTS.filter((e) => e.category === def.category && e.id !== def.id)
        .sort((a, b) => Math.abs(a.number - def.number) - Math.abs(b.number - def.number))
        .slice(0, 4),
    [def],
  );

  const ar = RATIO_VALUE[settings.ratio];
  const playing = !!ps?.playing;

  return (
    <div className="detail-view">
      <nav className="detail-nav" aria-label="效果導覽">
        <a className="btn btn-ghost" href="#/">
          <Icon name="back" /> 返回圖鑑
        </a>
        <div className="detail-nav-right">
          <a className="btn btn-ghost" href={`#/e/${prev.id}`} aria-label={`上一個：${prev.nameZh}`}>
            <Icon name="left" /> <span className="hide-sm">{pad2(prev.number)} {prev.nameZh}</span>
          </a>
          <a className="btn btn-ghost" href={`#/e/${next.id}`} aria-label={`下一個：${next.nameZh}`}>
            <span className="hide-sm">{pad2(next.number)} {next.nameZh}</span> <Icon name="right" />
          </a>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`#/e/${randomEffectId(def.id)}`)}>
            <Icon name="shuffle" /> <span className="hide-sm">隨機</span>
          </button>
        </div>
      </nav>

      <header className="detail-head" style={{ ['--accent' as string]: cat.color }}>
        <div className="detail-meta">
          <span className="detail-num">{pad2(def.number)}</span>
          <span className="card-cat">{cat.label}</span>
        </div>
        <h1 ref={titleRef} tabIndex={-1} className="detail-title">
          {def.nameZh} <span className="detail-en">{def.nameEn}</span>
        </h1>
        <p className="detail-desc">{def.description}</p>
      </header>

      <div className="detail-grid">
        <section className="detail-stage-col" aria-label="動畫舞台">
          <div className="stage-frame" style={{ ['--ar' as string]: String(ar) }}>
            <div
              ref={stageRef}
              className="detail-stage"
              role="img"
              aria-label={`${def.nameZh}動畫：${settings.text.trim() || def.defaultText}`}
              style={{ aspectRatio: String(ar) }}
            />
          </div>
          {ps?.error && <p className="stage-note error" role="alert">{ps.error}</p>}
          {ps?.notice && <p className="stage-note">{ps.notice}</p>}
          {reduced && !playing && ps?.ready && <p className="stage-note">已偵測到「減少動態」偏好：預設顯示靜態畫面，按「播放」即可觀看動畫。</p>}
          {def.interactive && <p className="stage-note subtle">這是互動效果：在舞台上移動滑鼠或以手指拖曳；閒置時會自動示範。</p>}

          <div className="transport" role="toolbar" aria-label="播放控制">
            <button type="button" className="btn btn-primary" onClick={() => playerRef.current?.toggle()} aria-label={playing ? '暫停' : '播放'}>
              <Icon name={playing ? 'pause' : 'play'} /> {playing ? '暫停' : '播放'}
            </button>
            <button type="button" className="btn" onClick={() => playerRef.current?.restart()}>
              <Icon name="replay" /> 重播
            </button>
            {def.loopable && (
              <button type="button" className={`btn${settings.loop ? ' is-on' : ''}`} aria-pressed={settings.loop} onClick={() => patch({ loop: !settings.loop })}>
                <Icon name="loop" /> 循環{settings.loop ? '：開' : '：關'}
              </button>
            )}
            <div className="seg" role="group" aria-label="舞台比例">
              {RATIOS.map((r) => (
                <button key={r} type="button" className={settings.ratio === r ? 'on' : ''} aria-pressed={settings.ratio === r} onClick={() => patch({ ratio: r })}>
                  {r}
                </button>
              ))}
            </div>
            <span className="transport-spacer" />
            <button type="button" className={`btn${fav ? ' is-on' : ''}`} aria-pressed={fav} onClick={() => toggleFavorite(def.id)}>
              <Icon name={fav ? 'heartFill' : 'heart'} /> {fav ? '已收藏' : '收藏'}
            </button>
            <button type="button" className="btn" onClick={share}>
              <Icon name="link" /> 複製分享連結
            </button>
            {ps?.canCapture && (
              <button type="button" className="btn" onClick={capture}>
                <Icon name="camera" /> 截取 PNG
              </button>
            )}
            {canRecord && (
              <button type="button" className="btn" onClick={record} disabled={recording}>
                <Icon name="video" /> {recording ? '錄製中…' : '錄製 5 秒 WebM'}
              </button>
            )}
          </div>
        </section>

        <aside className="panel" aria-label="效果設定">
          <ControlPanel
            def={def}
            settings={settings}
            onChange={patch}
            onParam={setParam}
            onReset={reset}
            onExportJSON={exportJSON}
            onImportJSON={importJSON}
            importMessage={importMsg}
          />
        </aside>

        <section className="detail-info" aria-label="效果說明">
          <div className="info-block">
            <h2>適用場景</h2>
            <ul className="chips-static">
              {def.suitableFor.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="info-block">
            <h2>基本原理</h2>
            <p>{def.implementationNotes}</p>
          </div>
          <div className="info-block">
            <h2>標籤</h2>
            <ul className="chips-static">
              <li className={`diff-${def.difficulty}`}>{DIFFICULTY_LABEL[def.difficulty]}</li>
              <li>{RENDERER_LABEL[def.renderer]}</li>
              {def.webgl && <li>WebGL（Three.js）</li>}
              {def.interactive && <li>可互動</li>}
              {def.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          {related.length > 0 && (
            <div className="info-block">
              <h2>相關效果</h2>
              <ul className="related">
                {related.map((r) => (
                  <li key={r.id}>
                    <a href={`#/e/${r.id}`}>
                      <span className="related-num">{pad2(r.number)}</span>
                      <span className="related-name">{r.nameZh}</span>
                      <span className="related-en">{r.nameEn}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
