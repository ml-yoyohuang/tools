import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { CATEGORIES, CATEGORY_MAP, DIFFICULTY_LABEL, RENDERER_LABEL } from '../effects/catalog';
import { EFFECTS } from '../effects/registry';
import type { CategoryId, Difficulty, RendererKind } from '../engine/types';
import { configurePreviews } from '../state/previewScheduler';
import { isLowPower, navigate, setAutoPreview, useFavorites, usePrefs, useReducedMotion } from '../state/store';
import { EffectCard, pad2 } from './EffectCard';
import { Icon } from './ui';

// Filter state survives navigation to a detail page and back.
interface Filters {
  q: string;
  cat: CategoryId | 'all';
  diff: Difficulty | 'all';
  tech: RendererKind | 'all';
  favOnly: boolean;
}
const EMPTY: Filters = { q: '', cat: 'all', diff: 'all', tech: 'all', favOnly: false };
let filters: Filters = { ...EMPTY };
const subs = new Set<() => void>();
const filterStore = {
  get: () => filters,
  set(p: Partial<Filters>) {
    filters = { ...filters, ...p };
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
};
export const listMemory = { scrollY: 0, lastId: '' };

const norm = (s: string) => s.toLowerCase().normalize('NFKC');
const HAYSTACK = new Map(
  EFFECTS.map((e) => [
    e.id,
    norm([e.nameZh, e.nameEn, e.description, e.tags.join(' '), CATEGORY_MAP[e.category].label, pad2(e.number), e.defaultText, e.suitableFor.join(' '), RENDERER_LABEL[e.renderer]].join(' ')),
  ]),
);

export function randomEffectId(exclude?: string) {
  const pool = EFFECTS.filter((e) => e.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function ListView() {
  const f = useSyncExternalStore(filterStore.subscribe, filterStore.get);
  const favs = useFavorites();
  const reduced = useReducedMotion();
  const prefs = usePrefs();
  const autoPreview = prefs.autoPreview ?? !reduced;
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    configurePreviews({ autoplay: autoPreview, maxActive: isLowPower() ? 3 : 6 });
  }, [autoPreview]);

  // restore scroll + focus when coming back from a detail page
  useLayoutEffect(() => {
    if (listMemory.lastId) {
      window.scrollTo(0, listMemory.scrollY);
      const link = document.querySelector<HTMLAnchorElement>(`[data-effect-link="${listMemory.lastId}"]`);
      link?.focus({ preventScroll: true });
    }
    const save = () => {
      listMemory.scrollY = window.scrollY;
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);

  const results = useMemo(() => {
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    return EFFECTS.filter((e) => {
      if (f.cat !== 'all' && e.category !== f.cat) return false;
      if (f.diff !== 'all' && e.difficulty !== f.diff) return false;
      if (f.tech !== 'all' && e.renderer !== f.tech) return false;
      if (f.favOnly && !favs.includes(e.id)) return false;
      if (terms.length) {
        const h = HAYSTACK.get(e.id)!;
        return terms.every((t) => h.includes(t));
      }
      return true;
    });
  }, [f, favs]);

  const filtered = f.q || f.cat !== 'all' || f.diff !== 'all' || f.tech !== 'all' || f.favOnly;
  const favSet = useMemo(() => new Set(favs), [favs]);

  return (
    <div className="list-view">
      <header className="site-header">
        <div className="brand">
          <p className="brand-kicker">文字動態實驗室</p>
          <h1 className="brand-title">
            TYPE <span className="brand-slash">/</span> MOTION LAB
          </h1>
          <p className="brand-tagline">把文字變成節奏、情緒與空間。</p>
        </div>
        <div className="header-side">
          <dl className="stat">
            <dt>效果</dt>
            <dd>{EFFECTS.length}</dd>
          </dl>
          <dl className="stat">
            <dt>收藏</dt>
            <dd>{favs.length}</dd>
          </dl>
          <div className="header-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate(`#/e/${randomEffectId()}`)}>
              <Icon name="shuffle" /> 隨機效果
            </button>
            <button
              type="button"
              className={`btn${f.favOnly ? ' is-on' : ''}`}
              aria-pressed={f.favOnly}
              onClick={() => filterStore.set({ favOnly: !f.favOnly })}
            >
              <Icon name={f.favOnly ? 'heartFill' : 'heart'} /> 只看收藏
            </button>
            <button
              type="button"
              className={`btn btn-ghost${autoPreview ? ' is-on' : ''}`}
              aria-pressed={autoPreview}
              onClick={() => setAutoPreview(!autoPreview)}
              title={reduced ? '系統已開啟「減少動態」，預設不自動播放' : undefined}
            >
              <Icon name={autoPreview ? 'pause' : 'play'} /> {autoPreview ? '自動預覽：開' : '自動預覽：關'}
            </button>
          </div>
        </div>
      </header>

      <section className="toolbar" aria-label="搜尋與篩選">
        <div className="search">
          <Icon name="search" />
          <label htmlFor="search-input" className="sr-only">搜尋效果</label>
          <input
            id="search-input"
            ref={searchRef}
            type="search"
            placeholder="搜尋名稱、英文、描述或標籤（例：翻牌、3D、wave）"
            value={f.q}
            onChange={(e) => filterStore.set({ q: e.currentTarget.value })}
          />
          {f.q && (
            <button type="button" className="icon-btn" aria-label="清除搜尋" onClick={() => { filterStore.set({ q: '' }); searchRef.current?.focus(); }}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="filter-groups">
          <div className="chip-group" role="group" aria-label="分類">
            <span className="group-label">分類</span>
            <Chip on={f.cat === 'all'} onClick={() => filterStore.set({ cat: 'all' })}>全部</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} on={f.cat === c.id} color={c.color} onClick={() => filterStore.set({ cat: f.cat === c.id ? 'all' : c.id })}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="chip-group" role="group" aria-label="難度">
            <span className="group-label">難度</span>
            <Chip on={f.diff === 'all'} onClick={() => filterStore.set({ diff: 'all' })}>全部</Chip>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <Chip key={d} on={f.diff === d} onClick={() => filterStore.set({ diff: f.diff === d ? 'all' : d })}>
                {DIFFICULTY_LABEL[d]}
              </Chip>
            ))}
          </div>
          <div className="chip-group" role="group" aria-label="技術">
            <span className="group-label">技術</span>
            <Chip on={f.tech === 'all'} onClick={() => filterStore.set({ tech: 'all' })}>全部</Chip>
            {(Object.keys(RENDERER_LABEL) as RendererKind[]).map((r) => (
              <Chip key={r} on={f.tech === r} onClick={() => filterStore.set({ tech: f.tech === r ? 'all' : r })}>
                {RENDERER_LABEL[r]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="result-row" aria-live="polite">
          <span>
            顯示 <strong>{results.length}</strong> / {EFFECTS.length} 個效果
          </span>
          {filtered && (
            <button type="button" className="link-btn" onClick={() => filterStore.set({ ...EMPTY })}>
              清除所有篩選
            </button>
          )}
        </div>
      </section>

      {results.length ? (
        <ul className="grid" aria-label="效果列表">
          {results.map((def) => (
            <li key={def.id}>
              <EffectCard def={def} order={def.number} favorite={favSet.has(def.id)} reducedMotion={reduced} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="empty-title">{f.favOnly && !favs.length ? '還沒有收藏任何效果' : '找不到符合條件的效果'}</p>
          <p className="empty-text">
            {f.favOnly && !favs.length ? '在卡片右上角點愛心即可收藏，收藏會保存在這個瀏覽器中。' : '試試其他關鍵字，或放寬分類、難度與技術篩選。'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => filterStore.set({ ...EMPTY })}>
            清除篩選
          </button>
        </div>
      )}

      <footer className="site-footer">
        <p>TYPE / MOTION LAB — 所有動態皆由 HTML、CSS、SVG、Canvas 或 WebGL 即時產生。字體：Noto Sans TC / Noto Serif TC（SIL OFL）。</p>
        <p>快捷鍵（詳情頁）：空白鍵 播放／暫停 · R 重播 · ← → 上一個／下一個</p>
      </footer>
    </div>
  );
}

function Chip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick} style={color ? { ['--chip' as string]: color } : undefined}>
      {color && <span className="chip-dot" aria-hidden="true" />}
      {children}
    </button>
  );
}
