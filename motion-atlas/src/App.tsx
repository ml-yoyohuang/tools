import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DetailModal } from './components/DetailModal';
import { ListView, useFilteredEffects } from './components/ListView';
import { EFFECTS, getEffect, LEGACY_MAP } from './effects/registry';
import { playerStats } from './engine/player';
import { previewStats } from './state/previewScheduler';
import { migrateLegacyFavorites, navigate, usePrefs, useRoute } from './state/store';

migrateLegacyFavorites(LEGACY_MAP, new Set(EFFECTS.map((e) => e.id)));

// Debug / test hook (read-only data, no behaviour).
(window as unknown as { __ma: unknown }).__ma = {
  ids: EFFECTS.map((e) => e.id),
  stats: playerStats,
  previews: previewStats,
  effects: EFFECTS.map((e) => ({
    id: e.id,
    code: e.code,
    number: e.displayNumber,
    nameZh: e.nameZh,
    nameEn: e.nameEn,
    limits: e.limits ?? [],
    accept: e.accept,
    directions: e.directions ?? [],
    category: e.category,
    renderer: e.renderer,
    sourceType: e.sourceType,
    controls: e.controls,
    params: (e.params ?? []).map((p) => p.key),
    paramLabels: (e.params ?? []).map((p) => p.label),
    capabilities: e.capabilities,
    loopable: !!e.loopable,
    interactive: !!e.interactive,
    legacyIds: e.legacyIds ?? [],
  })),
};

export function App() {
  const route = useRoute();
  const prefs = usePrefs();
  const def = route.name === 'effect' && route.id ? getEffect(route.id) : undefined;
  const list = useFilteredEffects();
  const returnFocus = useRef<HTMLElement | null>(null);

  // theme
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  // lock page scroll while the modal is open (scroll position is kept)
  useEffect(() => {
    document.documentElement.classList.toggle('modal-open', !!def);
  }, [def]);

  // legacy id in the URL → canonical id
  useEffect(() => {
    if (def && route.id !== def.id) history.replaceState(null, '', `#/e/${def.id}${route.query.toString() ? '?' + route.query : ''}`);
  }, [def, route]);

  const onOpen = useCallback((id: string, from: HTMLElement | null) => {
    returnFocus.current = from ?? (document.activeElement as HTMLElement | null);
    navigate(`#/e/${id}`);
  }, []);

  const onClose = useCallback(() => {
    navigate('#/');
  }, []);

  // restore focus once the modal is gone and the list is no longer inert
  const wasOpen = useRef(false);
  useEffect(() => {
    const open = route.name === 'effect';
    if (wasOpen.current && !open) {
      const el = returnFocus.current;
      if (el && document.contains(el)) el.focus({ preventScroll: true });
      else document.getElementById('search-input')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [route.name]);

  const onNavigate = useCallback((id: string) => navigate(`#/e/${id}`), []);

  const neighbours = useMemo(() => {
    if (!def) return null;
    const pool = list.some((e) => e.id === def.id) ? list : EFFECTS;
    const i = pool.findIndex((e) => e.id === def.id);
    const n = pool.length;
    return { prev: pool[(i - 1 + n) % n], next: pool[(i + 1) % n] };
  }, [def, list]);

  return (
    <>
      <ListView modalOpen={!!def} onOpen={onOpen} />
      {route.name === 'effect' && !def && (
        <div className="modal-backdrop">
          <div className="modal modal-small" role="alertdialog" aria-modal="true" aria-labelledby="nf-title">
            <h2 id="nf-title">找不到這個效果</h2>
            <p>連結可能已失效或拼寫錯誤。</p>
            <button type="button" className="btn btn-primary" autoFocus onClick={onClose}>
              回到圖鑑
            </button>
          </div>
        </div>
      )}
      {def && neighbours && (
        <DetailModal key={`${def.id}:${route.nav}`} def={def} query={route.query} prev={neighbours.prev} next={neighbours.next} onClose={onClose} onNavigate={onNavigate} />
      )}
    </>
  );
}
