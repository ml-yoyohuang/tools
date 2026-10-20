import { memo, useEffect, useRef, useState } from 'react';
import { CATEGORY_MAP, RENDERER_LABEL } from '../effects/categories';
import { Player } from '../engine/player';
import type { EffectDef } from '../engine/types';
import { registerPreview } from '../state/previewScheduler';
import { isLowPower, toggleFavorite } from '../state/store';
import { Icon } from './ui';

// Mount a Player only while the card is near the viewport.
const nearCallbacks = new Map<Element, (near: boolean) => void>();
const nearIO =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (records) => {
          for (const r of records) nearCallbacks.get(r.target)?.(r.isIntersecting);
        },
        { rootMargin: '400px 0px' },
      )
    : null;

export const pad3 = (n: number) => String(n).padStart(3, '0');

interface Props {
  def: EffectDef;
  order: number;
  favorite: boolean;
  reducedMotion: boolean;
  previews: boolean;
  onOpen: (id: string, from: HTMLElement) => void;
}

function EffectCardImpl({ def, order, favorite, reducedMotion, previews, onOpen }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!nearIO);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const regRef = useRef<{ setPinned(on: boolean): void; setBlocked(on: boolean): void } | null>(null);
  const userPin = useRef(false);
  const userBlock = useRef(false);
  const hoverPin = useRef(false);
  const cat = CATEGORY_MAP[def.category];

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !nearIO) return;
    nearCallbacks.set(el, setNear);
    nearIO.observe(el);
    return () => {
      nearIO.unobserve(el);
      nearCallbacks.delete(el);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!near || !stage || !previews) return;
    const settings = { ...def.defaultSettings, ratio: '16:9' as const, loop: true };
    const player = new Player(stage, def, settings, {
      mode: 'card',
      autoplay: false,
      reducedMotion,
      lowPower: isLowPower(),
      onState: (s) => {
        setPlaying(s.playing);
        setReady(s.ready);
      },
    });
    const reg = registerPreview(def.id, stage, order, (on) => (on ? player.play() : player.pause()));
    regRef.current = reg;
    if (userPin.current || hoverPin.current) reg.setPinned(true);
    if (userBlock.current) reg.setBlocked(true);
    return () => {
      reg.unregister();
      regRef.current = null;
      player.dispose();
      setPlaying(false);
      setReady(false);
    };
  }, [near, def, order, reducedMotion, previews]);

  const updatePin = () => regRef.current?.setPinned(userPin.current || hoverPin.current);
  const label = `${def.code} ${def.nameZh} ${def.nameEn}`;

  return (
    <article
      ref={cardRef}
      className={`card${playing ? ' is-playing' : ''}`}
      style={{ ['--cat' as string]: cat.color }}
      data-effect={def.id}
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
        {previews ? (
          <div ref={stageRef} className="card-stage" role="img" aria-label={`${def.nameZh}預覽：${def.description}`} style={{ background: def.defaultSettings.background }} />
        ) : (
          <div className="card-stage card-stage-off" style={{ background: def.defaultSettings.background, color: def.defaultSettings.primary }} aria-hidden="true">
            <span>{def.code}</span>
          </div>
        )}
        {previews && (
          <button
            type="button"
            className="card-play"
            aria-pressed={playing}
            disabled={!ready}
            aria-label={playing ? `暫停 ${def.nameZh} 預覽` : `播放 ${def.nameZh} 預覽`}
            onClick={() => {
              userPin.current = !playing;
              userBlock.current = playing;
              regRef.current?.setBlocked(userBlock.current);
              updatePin();
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
            <span className="card-play-label">{playing ? '播放中' : '已暫停'}</span>
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className="card-num" title={`編號 ${pad3(def.displayNumber)}`}>
            {def.code}
          </span>
          <span className="card-cat">{cat.label}</span>
          <span className="card-tech">{RENDERER_LABEL[def.renderer]}</span>
        </div>
        <h3 className="card-title">
          <a
            href={`#/e/${def.id}`}
            className="card-link"
            data-effect-link={def.id}
            aria-label={`開啟 ${label}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onOpen(def.id, e.currentTarget);
            }}
          >
            <span className="card-zh">{def.nameZh}</span>
            <span className="card-en">{def.nameEn}</span>
          </a>
        </h3>
        <p className="card-desc">{def.description}</p>
      </div>
      <button
        type="button"
        className={`fav-btn${favorite ? ' on' : ''}`}
        aria-pressed={favorite}
        aria-label={favorite ? `取消收藏 ${def.nameZh}` : `收藏 ${def.nameZh}`}
        onClick={() => toggleFavorite(def.id)}
      >
        <Icon name={favorite ? 'heartFill' : 'heart'} size={16} />
      </button>
    </article>
  );
}

export const EffectCard = memo(EffectCardImpl);
