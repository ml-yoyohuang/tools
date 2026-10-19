import { useEffect, useRef } from 'react';
import { Player } from '../engine/player';
import { settingsFromQuery } from '../engine/settings';
import type { EffectDef } from '../engine/types';

/**
 * Test-only view: renders one stage at a fixed size and seeks to ?at=seconds.
 * Used by scripts/snap.mjs and the Playwright suite for deterministic screenshots.
 * #/snap/<id>?at=1.5&w=640&h=360&mode=card|detail&<settings>
 */
export function SnapView({ def, query }: { def: EffectDef; query: URLSearchParams }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = Math.min(1920, Math.max(80, Number(query.get('w')) || 640));
  const h = Math.min(1920, Math.max(80, Number(query.get('h')) || 360));
  const t = Math.max(0, Number(query.get('at')) || 0);
  const mode = query.get('mode') === 'card' ? 'card' : 'detail';
  const play = query.get('play') === '1';

  useEffect(() => {
    document.documentElement.dataset.snapReady = '0';
    const settings = settingsFromQuery(def, query);
    const p = new Player(ref.current!, def, settings, {
      mode,
      autoplay: false,
      reducedMotion: false,
      lowPower: false,
      startTime: t,
      onState: (s) => {
        if (s.ready) {
          if (play) p.play();
          requestAnimationFrame(() => requestAnimationFrame(() => (document.documentElement.dataset.snapReady = s.error ? 'error' : '1')));
        }
      },
    });
    (window as unknown as { __ktPlayer?: Player }).__ktPlayer = p;
    return () => p.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} id="snap-stage" style={{ width: w, height: h, position: 'relative' }} role="img" aria-label={def.nameZh} />;
}
