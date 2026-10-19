import { useEffect } from 'react';
import { DetailView } from './components/DetailView';
import { ListView } from './components/ListView';
import { SnapView } from './components/SnapView';
import { EFFECTS, getEffect, MISSING_IDS } from './effects/registry';
import { useRoute } from './state/store';
import { playerStats } from './engine/player';

// Debug / test hook (read-only data, no behaviour).
(window as unknown as { __kt: unknown }).__kt = {
  ids: EFFECTS.map((e) => e.id),
  missing: MISSING_IDS,
  stats: playerStats,
  effects: EFFECTS.map((e) => ({ id: e.id, number: e.number, renderer: e.renderer, webgl: !!e.webgl, params: (e.params ?? []).map((p) => p.key), hide: e.hide ?? [], loopable: !!e.loopable, interactive: !!e.interactive })),
};

export function App() {
  const route = useRoute();
  const def = route.id ? getEffect(route.id) : undefined;

  useEffect(() => {
    document.documentElement.classList.toggle('is-snap', route.name === 'snap');
  }, [route.name]);

  if (route.name === 'snap' && def) return <SnapView key={def.id + route.query.toString()} def={def} query={route.query} />;
  if (route.name === 'effect') {
    if (!def)
      return (
        <main className="not-found">
          <h1>找不到這個效果</h1>
          <p>連結可能已失效或拼寫錯誤。</p>
          <a className="btn btn-primary" href="#/">回到圖鑑</a>
        </main>
      );
    return (
      <main>
        <DetailView key={`${def.id}:${route.nav}`} def={def} query={route.query} />
      </main>
    );
  }
  return (
    <main>
      <ListView />
    </main>
  );
}
