import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { CATEGORIES, CATEGORY_MAP, RENDERER_LABEL, SOURCE_LABEL } from '../effects/categories';
import { EFFECTS } from '../effects/registry';
import type { CategoryId, EffectDef } from '../engine/types';
import { configurePreviews } from '../state/previewScheduler';
import { createStore, isLowPower, setGlobalPause, setPref, useFavorites, useGlobalPause, usePrefs, useReducedMotion, type SortKey } from '../state/store';
import { EffectCard, pad3 } from './EffectCard';
import { Icon } from './ui';

// Filter state lives outside React so it survives opening / closing the detail modal.
export interface Filters {
  q: string;
  cat: CategoryId | 'all' | 'favorites';
}
const EMPTY: Filters = { q: '', cat: 'all' };
export const filterStore = createStore<Filters>({ ...EMPTY });
const setFilters = (p: Partial<Filters>) => filterStore.set({ ...filterStore.get(), ...p });

const norm = (s: string) => s.toLowerCase().normalize('NFKC');
const HAYSTACK = new Map(
  EFFECTS.map((e) => [
    e.id,
    norm(
      [e.id, e.code, pad3(e.displayNumber), e.nameZh, e.nameEn, e.description, e.tags.join(' '), CATEGORY_MAP[e.category].label, CATEGORY_MAP[e.category].zh, e.suitable.join(' '), RENDERER_LABEL[e.renderer], SOURCE_LABEL[e.sourceType]].join(' '),
    ),
  ]),
);

/** "Recently added": effects that did not exist in the previous library first, newest codes last-in-first-out. */
const recentRank = (e: EffectDef) => (e.legacyIds?.length ? 0 : 1) * 1000 + e.displayNumber;

export function sortEffects(list: EffectDef[], sort: SortKey): EffectDef[] {
  const out = list.slice();
  if (sort === 'name') out.sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'));
  else if (sort === 'recent') out.sort((a, b) => recentRank(b) - recentRank(a));
  else out.sort((a, b) => a.displayNumber - b.displayNumber);
  return out;
}

export function useFilteredEffects(): EffectDef[] {
  const f = useSyncExternalStore(filterStore.subscribe, filterStore.get);
  const favs = useFavorites();
  const prefs = usePrefs();
  return useMemo(() => {
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    const list = EFFECTS.filter((e) => {
      if (f.cat === 'favorites' && !favs.includes(e.id)) return false;
      if (f.cat !== 'all' && f.cat !== 'favorites' && e.category !== f.cat) return false;
      if (terms.length) {
        const h = HAYSTACK.get(e.id)!;
        return terms.every((t) => h.includes(t));
      }
      return true;
    });
    return sortEffects(list, prefs.sort);
  }, [f, favs, prefs.sort]);
}

interface Props {
  modalOpen: boolean;
  onOpen: (id: string, from: HTMLElement | null) => void;
}

export function ListView({ modalOpen, onOpen }: Props) {
  const f = useSyncExternalStore(filterStore.subscribe, filterStore.get);
  const favs = useFavorites();
  const reduced = useReducedMotion();
  const prefs = usePrefs();
  const paused = useGlobalPause();
  const autoPreview = prefs.autoPreview ?? !reduced;
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useFilteredEffects();
  const rootRef = useRef<HTMLDivElement>(null);
  // background content is inert while the modal is open (focus can't leave the dialog)
  useEffect(() => {
    rootRef.current?.toggleAttribute('inert', modalOpen);
  }, [modalOpen]);

  useEffect(() => {
    configurePreviews({ autoplay: autoPreview, maxActive: isLowPower() ? 3 : 6, suspended: modalOpen || paused });
  }, [autoPreview, modalOpen, paused]);

  // counts per category for the current search text (category filter itself excluded)
  const counts = useMemo(() => {
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    const base = terms.length ? EFFECTS.filter((e) => terms.every((t) => HAYSTACK.get(e.id)!.includes(t))) : EFFECTS;
    const c: Record<string, number> = { all: base.length, favorites: base.filter((e) => favs.includes(e.id)).length };
    for (const e of base) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [f.q, favs]);

  const filtered = !!f.q || f.cat !== 'all';
  const favSet = useMemo(() => new Set(favs), [favs]);
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

  // "/" focuses the search field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.key !== '/' || (e.target as HTMLElement).closest('input, textarea, select')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const random = () => {
    const pool = results.length ? results : EFFECTS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onOpen(pick.id, null);
  };

  return (
    <div className="list-view" ref={rootRef} aria-hidden={modalOpen || undefined}>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="MOTION ATLAS 動效圖鑑 首頁">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <b />
          </span>
          <span className="brand-name">MOTION ATLAS</span>
          <span className="brand-zh">動效圖鑑</span>
        </a>
        <div className="search">
          <Icon name="search" size={16} />
          <label htmlFor="search-input" className="sr-only">
            搜尋效果
          </label>
          <input
            id="search-input"
            ref={searchRef}
            type="search"
            autoComplete="off"
            placeholder="搜尋名稱、英文、說明、標籤或 ID（例：半色調、wave、T03）"
            value={f.q}
            onChange={(e) => setFilters({ q: e.currentTarget.value.slice(0, 80) })}
          />
          {f.q && (
            <button
              type="button"
              className="icon-btn"
              aria-label="清除搜尋"
              onClick={() => {
                setFilters({ q: '' });
                searchRef.current?.focus();
              }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div className="topbar-actions">
          <button type="button" className={`btn btn-sm${paused ? ' is-on' : ''}`} aria-pressed={paused} onClick={() => setGlobalPause(!paused)}>
            <Icon name={paused ? 'play' : 'stop'} size={14} /> {paused ? '恢復動畫' : '暫停全部動畫'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon"
            aria-label={dark ? '切換為淺色模式' : '切換為深色模式'}
            title={dark ? '淺色模式' : '深色模式'}
            onClick={() => setPref('theme', dark ? 'light' : 'dark')}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={16} />
          </button>
        </div>
      </header>

      <section className="toolbar" aria-label="篩選與排序">
        <div className="chips" role="group" aria-label="分類">
          <Chip on={f.cat === 'all'} count={counts.all} onClick={() => setFilters({ cat: 'all' })}>
            ALL
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} on={f.cat === c.id} count={counts[c.id] ?? 0} color={c.color} title={c.zh} onClick={() => setFilters({ cat: f.cat === c.id ? 'all' : c.id })}>
              {c.label}
            </Chip>
          ))}
          <Chip on={f.cat === 'favorites'} count={counts.favorites} icon onClick={() => setFilters({ cat: f.cat === 'favorites' ? 'all' : 'favorites' })}>
            FAVORITES
          </Chip>
        </div>
        <div className="toolbar-row">
          <p className="result-count" aria-live="polite">
            <strong>{results.length}</strong> 個效果{filtered && <span className="muted">（共 {EFFECTS.length}）</span>}
            {filtered && (
              <button type="button" className="link-btn" onClick={() => setFilters({ ...EMPTY })}>
                清除篩選
              </button>
            )}
          </p>
          <div className="toolbar-controls">
            <label className="select-inline">
              <span>排序</span>
              <select value={prefs.sort} onChange={(e) => setPref('sort', e.currentTarget.value as SortKey)}>
                <option value="number">編號</option>
                <option value="name">名稱（英文）</option>
                <option value="recent">最近新增</option>
              </select>
            </label>
            <button type="button" className="btn btn-sm" onClick={random}>
              <Icon name="shuffle" size={14} /> 隨機探索
            </button>
            <button type="button" className={`btn btn-sm${prefs.previews ? ' is-on' : ''}`} aria-pressed={prefs.previews} onClick={() => setPref('previews', !prefs.previews)}>
              <Icon name={prefs.previews ? 'eye' : 'eyeOff'} size={14} /> 列表預覽
            </button>
            <button
              type="button"
              className={`btn btn-sm${autoPreview ? ' is-on' : ''}`}
              aria-pressed={autoPreview}
              disabled={!prefs.previews}
              onClick={() => setPref('autoPreview', !autoPreview)}
              title={reduced ? '系統已開啟「減少動態」，預設不自動播放' : '捲入可視區域的卡片自動播放（同時最多 6 張）'}
            >
              <Icon name="play" size={14} /> 可視區自動播放
            </button>
          </div>
        </div>
      </section>

      {results.length ? (
        <ul className="grid" aria-label="效果列表">
          {results.map((def) => (
            <li key={def.id}>
              <EffectCard def={def} order={def.displayNumber} favorite={favSet.has(def.id)} reducedMotion={reduced} previews={prefs.previews} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="empty-title">{f.cat === 'favorites' && !favs.length ? '還沒有收藏任何效果' : '找不到符合條件的效果'}</p>
          <p className="empty-text">
            {f.cat === 'favorites' && !favs.length ? '在卡片右上角點愛心即可收藏，收藏會保存在這個瀏覽器中。' : '試試其他關鍵字（中文、英文、標籤或 ID 都可以），或切回 ALL。'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setFilters({ ...EMPTY })}>
            清除篩選
          </button>
        </div>
      )}

      <footer className="site-footer">
        <p>
          MOTION ATLAS — {EFFECTS.length} 個效果皆以 DOM、SVG、CSS 3D 或 Canvas 2D 即時生成。字體：Noto Sans TC、Noto Serif TC、Oswald、JetBrains Mono（SIL OFL）。
        </p>
        <p>快捷鍵：/ 搜尋 · 詳情內 空白鍵 播放／暫停 · R 重播 · ← → 上一個／下一個 · Esc 關閉</p>
      </footer>
    </div>
  );
}

function Chip(props: { on: boolean; onClick: () => void; children: React.ReactNode; count: number; color?: string; title?: string; icon?: boolean }) {
  const { on, onClick, children, count, color, title, icon } = props;
  return (
    <button
      type="button"
      className={`chip${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
      title={title}
      style={color ? { ['--chip' as string]: color } : undefined}
    >
      {color && <span className="chip-dot" aria-hidden="true" />}
      {icon && <Icon name={on ? 'heartFill' : 'heart'} size={12} />}
      <span>{children}</span>
      <span className="chip-count">{count}</span>
    </button>
  );
}
