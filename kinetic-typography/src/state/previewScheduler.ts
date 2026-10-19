// Limits how many card previews animate at once. Cards register when mounted;
// visibility comes from one shared IntersectionObserver. Pinned cards (hover,
// keyboard focus or the card's play button) always play; the remaining slots go
// to visible cards in document order when auto preview is on.

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
  const pinned = list.filter((e) => e.pinned && !e.blocked);
  let slots = Math.max(0, maxActive - pinned.length);
  for (const e of list) {
    let on = e.pinned && !e.blocked;
    if (!on && !e.blocked && autoplay && e.visible && slots > 0) {
      on = true;
      slots--;
    }
    if (on !== e.active) {
      e.active = on;
      e.setActive(on);
    }
  }
}

export function configurePreviews(opts: { autoplay: boolean; maxActive: number }) {
  autoplay = opts.autoplay;
  maxActive = opts.maxActive;
  schedule();
}

export function registerPreview(id: string, el: HTMLElement, order: number, setActive: (on: boolean) => void) {
  const entry: Entry = { el, order, visible: false, pinned: false, blocked: false, active: false, setActive };
  entries.set(id, entry);
  el.dataset.previewId = id;
  io?.observe(el);
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
