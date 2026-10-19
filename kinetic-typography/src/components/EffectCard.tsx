import { memo, useEffect, useRef, useState } from 'react';
import { CATEGORY_MAP, DIFFICULTY_LABEL, RENDERER_LABEL } from '../effects/catalog';
import { Player } from '../engine/player';
import { defaultSettings } from '../engine/settings';
import type { EffectDef } from '../engine/types';
import { registerPreview } from '../state/previewScheduler';
import { isLowPower, toggleFavorite } from '../state/store';
import { Icon } from './ui';

const nearObserverCallbacks = new Map<Element, (near: boolean) => void>();
const nearIO =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (records) => {
          for (const r of records) nearObserverCallbacks.get(r.target)?.(r.isIntersecting);
        },
        { rootMargin: '480px 0px' },
      )
    : null;

export const pad2 = (n: number) => String(n).padStart(2, '0');

interface Props {
  def: EffectDef;
  order: number;
  favorite: boolean;
  reducedMotion: boolean;
}

function EffectCardImpl({ def, order, favorite, reducedMotion }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const pinRef = useRef<{ setPinned(on: boolean): void; setBlocked(on: boolean): void } | null>(null);
  const userPin = useRef(false);
  const userBlock = useRef(false);
  const hoverPin = useRef(false);
  const cat = CATEGORY_MAP[def.category];

  // mount a Player only while the card is near the viewport
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (!nearIO) {
      setNear(true);
      return;
    }
    nearObserverCallbacks.set(el, setNear);
    nearIO.observe(el);
    return () => {
      nearIO.unobserve(el);
      nearObserverCallbacks.delete(el);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!near || !stage) return;
    const settings = { ...defaultSettings(def), ratio: '16:9' as const, loop: true };
    const player = new Player(stage, def, settings, {
      mode: 'card',
      autoplay: false,
      reducedMotion,
      lowPower: isLowPower(),
      onState: (s) => setPlaying(s.playing),
    });
    const reg = registerPreview(def.id, stage, order, (on) => (on ? player.play() : player.pause()));
    pinRef.current = reg;
    if (userPin.current || hoverPin.current) reg.setPinned(true);
    if (userBlock.current) reg.setBlocked(true);
    return () => {
      reg.unregister();
      pinRef.current = null;
      player.dispose();
      setPlaying(false);
    };
  }, [near, def, order, reducedMotion]);

  const updatePin = () => pinRef.current?.setPinned(userPin.current || hoverPin.current);

  return (
    <article
      ref={cardRef}
      className={`card${playing ? ' is-playing' : ''}`}
      style={{ ['--accent' as string]: cat.color }}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          hoverPin.current = true;
          updatePin();
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          hoverPin.current = false;
          updatePin();
        }
      }}
      onFocus={() => {
        hoverPin.current = true;
        updatePin();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          hoverPin.current = false;
          updatePin();
        }
      }}
    >
      <div className="card-stage-wrap">
        <div ref={stageRef} className="card-stage" role="img" aria-label={`${def.nameZh} 動畫預覽：${def.defaultText}`} />
        <button
          type="button"
          className="card-play"
          aria-pressed={playing}
          aria-label={playing ? `暫停 ${def.nameZh} 預覽` : `播放 ${def.nameZh} 預覽`}
          onClick={() => {
            userPin.current = !playing;
            userBlock.current = playing;
            pinRef.current?.setBlocked(userBlock.current);
            updatePin();
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className="card-num">{pad2(def.number)}</span>
          <span className="card-cat">{cat.label}</span>
        </div>
        <h3 className="card-title">
          <a href={`#/e/${def.id}`} className="card-link" data-effect-link={def.id}>
            {def.nameZh}
            <span className="card-en">{def.nameEn}</span>
          </a>
        </h3>
        <p className="card-desc">{def.description}</p>
        <ul className="card-tags" aria-label="標籤">
          <li className={`tag diff-${def.difficulty}`}>{DIFFICULTY_LABEL[def.difficulty]}</li>
          <li className="tag">{RENDERER_LABEL[def.renderer]}{def.webgl ? ' · WebGL' : ''}</li>
          {def.interactive && <li className="tag">可互動</li>}
        </ul>
      </div>
      <button
        type="button"
        className={`fav-btn${favorite ? ' on' : ''}`}
        aria-pressed={favorite}
        aria-label={favorite ? `取消收藏 ${def.nameZh}` : `收藏 ${def.nameZh}`}
        onClick={() => toggleFavorite(def.id)}
      >
        <Icon name={favorite ? 'heartFill' : 'heart'} size={18} />
      </button>
    </article>
  );
}

export const EffectCard = memo(EffectCardImpl);
