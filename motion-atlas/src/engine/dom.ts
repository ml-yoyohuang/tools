import { gsap } from 'gsap';
import type { Glyph, TextLayout } from './text';

type StyleMap = Partial<Record<string, string | number>>;

/** Create an element. Text is always inserted with textContent (never innerHTML). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; style?: StyleMap; text?: string; attrs?: Record<string, string> } = {},
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.style) setStyle(node, opts.style);
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

export function setStyle(node: HTMLElement | SVGElement, style: StyleMap) {
  const s = (node as HTMLElement).style;
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined) continue;
    if (k.startsWith('--')) s.setProperty(k, String(v));
    else (s as unknown as Record<string, string>)[k] = typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : String(v);
  }
}
const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'scale', 'order']);

export const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

/** A full-stage absolutely positioned layer. */
export function layer(parent: HTMLElement, style: StyleMap = {}, className = ''): HTMLDivElement {
  return el('div', { className, style: { position: 'absolute', inset: '0', ...style } }, parent);
}

export interface GlyphSpanOptions {
  color?: string;
  font?: string;
  className?: string;
  style?: StyleMap;
  /** include whitespace glyphs (default false) */
  includeSpaces?: boolean;
}

/**
 * Absolutely positioned span per glyph, centred on (g.cx, g.cy) via GSAP
 * xPercent/yPercent = -50. Animate with GSAP x / y / scale / rotation. If you write
 * style.transform yourself instead, start it with `translate(-50%,-50%)`.
 */
export function glyphSpans(
  parent: HTMLElement,
  layout: TextLayout,
  opts: GlyphSpanOptions = {},
): { el: HTMLSpanElement; g: Glyph }[] {
  const out: { el: HTMLSpanElement; g: Glyph }[] = [];
  const list = opts.includeSpaces ? layout.glyphs : layout.chars;
  for (const g of list) {
    const span = el(
      'span',
      {
        className: opts.className,
        text: g.ch,
        style: {
          position: 'absolute',
          left: g.cx,
          top: g.cy,
          font: opts.font ?? layout.font,
          lineHeight: '1',
          whiteSpace: 'pre',
          color: opts.color,
          willChange: 'transform',
          ...opts.style,
        },
      },
      parent,
    );
    gsap.set(span, { xPercent: -50, yPercent: -50 });
    out.push({ el: span, g });
  }
  return out;
}

/**
 * A centred block of normal (flowing) text lines – useful when the effect animates
 * whole lines or the block instead of individual glyphs.
 */
export function textBlock(
  parent: HTMLElement,
  layout: TextLayout,
  opts: { color?: string; style?: StyleMap; lineStyle?: StyleMap } = {},
): { block: HTMLDivElement; lines: HTMLDivElement[] } {
  const block = el(
    'div',
    {
      style: {
        position: 'absolute',
        left: layout.x,
        top: layout.y,
        width: layout.width + 2,
        height: layout.height,
        font: layout.font,
        lineHeight: `${layout.lineHeight}px`,
        letterSpacing: `${layout.tracking}em`,
        color: opts.color,
        textAlign: 'center',
        whiteSpace: 'pre',
        ...opts.style,
      },
    },
    parent,
  );
  const lines = layout.lines.map((l) =>
    el('div', { text: l.text, style: { height: layout.lineHeight, marginRight: `${-layout.tracking}em`, ...opts.lineStyle } }, block),
  );
  return { block, lines };
}

/** Remove every child (used on dispose). */
export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Listen and get an unsubscribe function. */
export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Window | Document,
  type: K,
  fn: (e: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, fn as EventListener, opts);
  return () => target.removeEventListener(type, fn as EventListener, opts);
}


/** Full-stage SVG in css px (viewBox = stage size). Return it as runtime.svg to enable PNG export. */
export function stageSvg(parent: HTMLElement, w: number, h: number): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, preserveAspectRatio: 'none' }, parent);
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden';
  return svg;
}
