// Limits how many card previews animate at once. Cards register when mounted;
// visibility comes from one shared IntersectionObserver. Pinned cards (hover,
// keyboard focus or the card's play button) play first; remaining slots go to
// visible cards in document order when auto preview is on. `suspended` (detail
// modal open / global pause) stops every card.

interface Entry {
  el: HTMLElement;
  order: number;
  visible: boolean;
  pinned: boolean;
  /** user explicitly paused this card */
  blocked: boolean;
  active: boolean;
  setActive: (on: boolean) => void;
}

const entries = new Map<string, Entry>();
let autoplay = true;
let maxActive = 6;
let suspended = false;
let raf = 0;

const io =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (records) => {
          for (const r of records) {
            const id = (r.target as HTMLElement).dataset.previewId;
            const e = id ? entries.get(id) : undefined;
            if (e) e.visible = r.isIntersecting && r.intersectionRatio >= 0.35;
          }
          schedule();
        },
        { threshold: [0, 0.35, 0.7] },
      )
    : null;

function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    recompute();
  });
}

function recompute() {
  const list = [...entries.values()].sort((a, b) => a.order - b.order);
  // pinned cards still respect the cap and only play while visible
  let slots = suspended ? 0 : maxActive;
  const want = new Set<Entry>();
  for (const e of list) if (e.pinned && !e.blocked && e.visible && slots > 0) (want.add(e), slots--);
  if (autoplay) for (const e of list) if (!want.has(e) && !e.blocked && e.visible && slots > 0) (want.add(e), slots--);
  for (const e of list) {
    const on = want.has(e);
    if (on !== e.active) {
      e.active = on;
      e.setActive(on);
    }
  }
}

export function configurePreviews(opts: { autoplay?: boolean; maxActive?: number; suspended?: boolean }) {
  if (opts.autoplay !== undefined) autoplay = opts.autoplay;
  if (opts.maxActive !== undefined) maxActive = opts.maxActive;
  if (opts.suspended !== undefined) suspended = opts.suspended;
  schedule();
}

export const previewStats = () => ({ registered: entries.size, active: [...entries.values()].filter((e) => e.active).length, maxActive });

export function registerPreview(id: string, el: HTMLElement, order: number, setActive: (on: boolean) => void) {
  const entry: Entry = { el, order, visible: false, pinned: false, blocked: false, active: false, setActive };
  entries.set(id, entry);
  el.dataset.previewId = id;
  io?.observe(el);
  if (!io) entry.visible = true;
  schedule();
  return {
    setPinned(on: boolean) {
      entry.pinned = on;
      schedule();
    },
    setBlocked(on: boolean) {
      entry.blocked = on;
      schedule();
    },
    isActive: () => entry.active,
    unregister() {
      io?.unobserve(el);
      if (entries.get(id) === entry) entries.delete(id);
      schedule();
    },
  };
}
