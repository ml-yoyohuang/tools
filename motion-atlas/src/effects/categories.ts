import type { CategoryId, Difficulty, RendererKind, SourceType } from '../engine/types';

export const CATEGORIES: { id: CategoryId; label: string; zh: string; color: string; prefix: string }[] = [
  { id: 'typography', label: 'TYPOGRAPHY', zh: '文字', color: '#3450FF', prefix: 'T' },
  { id: 'halftone', label: 'HALFTONE', zh: '半色調', color: '#ED589A', prefix: 'H' },
  { id: 'grid', label: 'GRID', zh: '網格', color: '#2BA36B', prefix: 'G' },
  { id: 'lines', label: 'LINES', zh: '線條', color: '#E63A2E', prefix: 'L' },
  { id: 'shapes', label: 'SHAPES', zh: '圖形', color: '#E8A400', prefix: 'S' },
  { id: 'split', label: 'SPLIT', zh: '分割', color: '#7A5CFF', prefix: 'P' },
  { id: 'wipe', label: 'WIPE', zh: '擦拭', color: '#00A3C4', prefix: 'W' },
  { id: 'comic', label: 'COMIC', zh: '漫畫', color: '#FF6A00', prefix: 'C' },
  { id: 'minimal', label: 'MINIMAL', zh: '極簡', color: '#5C5C5C', prefix: 'M' },
];
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, (typeof CATEGORIES)[number]>;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: '入門', intermediate: '中階', advanced: '進階' };
export const RENDERER_LABEL: Record<RendererKind, string> = { dom: 'DOM', svg: 'SVG', canvas: 'Canvas 2D', css3d: 'CSS 3D' };
export const SOURCE_LABEL: Record<SourceType, string> = { reference: '參考重建', 'partial-reference': '部分參考', original: '延伸設計' };
