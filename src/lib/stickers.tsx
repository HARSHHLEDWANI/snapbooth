/**
 * stickers.tsx — 25+ inline SVG stickers. Each is defined once as a raw SVG
 * markup string so it can be (a) rendered as a React element in the picker and
 * (b) drawn into the export canvas via an <img src="data:..."> at any scale.
 */
import type { ReactElement } from 'react';

export interface StickerDef {
  key: string;
  label: string;
  svg: string; // full <svg> markup, 100x100 viewBox
}

const S = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${inner}</svg>`;

export const STICKERS: StickerDef[] = [
  { key: 'heart', label: 'heart', svg: S(`<path d="M50 82S12 58 12 34c0-12 9-20 20-20 8 0 15 5 18 12 3-7 10-12 18-12 11 0 20 8 20 20 0 24-38 48-38 48z" fill="#FF8FAB" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'heart2', label: 'mini heart', svg: S(`<path d="M50 78S18 57 18 37c0-10 7-16 16-16 7 0 13 4 16 10 3-6 9-10 16-10 9 0 16 6 16 16 0 20-32 41-32 41z" fill="#FFD6E0" stroke="#FF8FAB" stroke-width="3"/>`) },
  { key: 'bow', label: 'bow', svg: S(`<g stroke="#6B4F4F" stroke-width="3"><path d="M50 50 20 32c-4-2-8 1-8 6v24c0 5 4 8 8 6l30-18z" fill="#FF8FAB"/><path d="M50 50 80 32c4-2 8 1 8 6v24c0 5-4 8-8 6L50 50z" fill="#FF8FAB"/><circle cx="50" cy="50" r="8" fill="#FFD6E0"/></g>`) },
  { key: 'star', label: 'star', svg: S(`<path d="M50 10l11 26 28 2-21 18 7 27-25-15-25 15 7-27-21-18 28-2z" fill="#FFE8A3" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'star2', label: 'twinkle', svg: S(`<path d="M50 14c3 20 16 33 34 36-18 3-31 16-34 36-3-20-16-33-34-36 18-3 31-16 34-36z" fill="#FFF3C4" stroke="#FFC94D" stroke-width="3"/>`) },
  { key: 'sparkle', label: 'sparkle', svg: S(`<path d="M50 18l6 22 22 6-22 6-6 22-6-22-22-6 22-6z" fill="#BDE0FE" stroke="#6B4F4F" stroke-width="2.5"/>`) },
  { key: 'cloud', label: 'cloud', svg: S(`<path d="M30 68c-11 0-18-8-18-17s7-16 16-16c2-11 12-19 24-19 13 0 23 9 24 22 9 1 15 8 15 16 0 8-7 14-16 14z" fill="#fff" stroke="#BDE0FE" stroke-width="3"/>`) },
  { key: 'rainbow', label: 'rainbow', svg: S(`<g fill="none" stroke-width="6" stroke-linecap="round"><path d="M18 74a32 32 0 0164 0" stroke="#FF8FAB"/><path d="M28 74a22 22 0 0144 0" stroke="#FFE8A3"/><path d="M38 74a12 12 0 0124 0" stroke="#BDE0FE"/></g>`) },
  { key: 'flower', label: 'flower', svg: S(`<g stroke="#6B4F4F" stroke-width="2.5"><circle cx="50" cy="28" r="12" fill="#FFD6E0"/><circle cx="72" cy="44" r="12" fill="#FFD6E0"/><circle cx="64" cy="70" r="12" fill="#FFD6E0"/><circle cx="36" cy="70" r="12" fill="#FFD6E0"/><circle cx="28" cy="44" r="12" fill="#FFD6E0"/><circle cx="50" cy="50" r="12" fill="#FFE8A3"/></g>`) },
  { key: 'tulip', label: 'tulip', svg: S(`<path d="M50 88V52" stroke="#7bbf6a" stroke-width="4"/><path d="M50 52c-14 0-22-10-22-24 8 6 14 6 22-4 8 10 14 10 22 4 0 14-8 24-22 24z" fill="#FF8FAB" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'bunny', label: 'bunny ears', svg: S(`<g stroke="#6B4F4F" stroke-width="3"><ellipse cx="38" cy="40" rx="10" ry="26" fill="#fff"/><ellipse cx="62" cy="40" rx="10" ry="26" fill="#fff"/><ellipse cx="38" cy="40" rx="4" ry="16" fill="#FFD6E0"/><ellipse cx="62" cy="40" rx="4" ry="16" fill="#FFD6E0"/></g>`) },
  { key: 'cat', label: 'cat', svg: S(`<g stroke="#6B4F4F" stroke-width="3"><path d="M28 40 24 20l18 10zM72 40 76 20 58 30z" fill="#FFE8A3"/><circle cx="50" cy="52" r="26" fill="#FFE8A3"/><circle cx="41" cy="50" r="3" fill="#6B4F4F"/><circle cx="59" cy="50" r="3" fill="#6B4F4F"/><path d="M46 60c2 3 6 3 8 0" fill="none"/></g>`) },
  { key: 'crown', label: 'crown', svg: S(`<path d="M20 68l-6-34 20 14 16-24 16 24 20-14-6 34z" fill="#FFE8A3" stroke="#6B4F4F" stroke-width="3"/><circle cx="50" cy="42" r="4" fill="#FF8FAB"/>`) },
  { key: 'diamond', label: 'gem', svg: S(`<path d="M30 24h40l16 20-36 40L14 44z" fill="#BDE0FE" stroke="#6B4F4F" stroke-width="3"/><path d="M14 44h72M50 84 30 24M50 84 70 24" fill="none" stroke="#6B4F4F" stroke-width="2"/>`) },
  { key: 'moon', label: 'moon', svg: S(`<path d="M62 18a34 34 0 100 64 26 26 0 010-64z" fill="#FFE8A3" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'sun', label: 'sun', svg: S(`<g stroke="#FFC94D" stroke-width="4" stroke-linecap="round"><path d="M50 8v12M50 80v12M8 50h12M80 50h12M20 20l8 8M72 72l8 8M80 20l-8 8M28 72l-8 8"/></g><circle cx="50" cy="50" r="20" fill="#FFE8A3" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'lollipop', label: 'lolly', svg: S(`<circle cx="46" cy="34" r="22" fill="#FFD6E0" stroke="#6B4F4F" stroke-width="3"/><path d="M46 34c0-12 20-12 20 0s-20 12-20 0" fill="#FF8FAB"/><path d="M50 54l6 34" stroke="#6B4F4F" stroke-width="4"/>`) },
  { key: 'cupcake', label: 'cupcake', svg: S(`<path d="M28 52h44l-6 32H34z" fill="#FFF3C4" stroke="#6B4F4F" stroke-width="3"/><path d="M26 52c0-16 48-16 48 0z" fill="#FF8FAB" stroke="#6B4F4F" stroke-width="3"/><circle cx="50" cy="26" r="5" fill="#FF6B93"/>`) },
  { key: 'strawberry', label: 'berry', svg: S(`<path d="M50 30c16 0 26 12 26 26S64 88 50 88 24 68 24 56s10-26 26-26z" fill="#FF6B93" stroke="#6B4F4F" stroke-width="3"/><path d="M38 22c4 6 8 8 12 8s8-2 12-8c-4-2-8-2-12 2-4-4-8-4-12-2z" fill="#7bbf6a"/><g fill="#FFE8A3"><circle cx="44" cy="52" r="2"/><circle cx="56" cy="52" r="2"/><circle cx="50" cy="64" r="2"/></g>`) },
  { key: 'speech', label: 'hi!', svg: S(`<path d="M18 24h64v40H52l-14 14v-14H18z" fill="#fff" stroke="#6B4F4F" stroke-width="3"/><text x="50" y="52" font-size="20" text-anchor="middle" fill="#FF8FAB" font-family="sans-serif" font-weight="bold">hi!</text>`) },
  { key: 'love', label: 'love', svg: S(`<rect x="10" y="30" width="80" height="40" rx="20" fill="#FF8FAB" stroke="#6B4F4F" stroke-width="3"/><text x="50" y="58" font-size="20" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">love</text>`) },
  { key: 'bestie', label: 'bestie', svg: S(`<rect x="6" y="32" width="88" height="36" rx="18" fill="#FFE8A3" stroke="#6B4F4F" stroke-width="3"/><text x="50" y="57" font-size="17" text-anchor="middle" fill="#6B4F4F" font-family="sans-serif" font-weight="bold">bestie</text>`) },
  { key: 'cute', label: 'cute', svg: S(`<rect x="14" y="32" width="72" height="36" rx="18" fill="#BDE0FE" stroke="#6B4F4F" stroke-width="3"/><text x="50" y="57" font-size="18" text-anchor="middle" fill="#6B4F4F" font-family="sans-serif" font-weight="bold">cute</text>`) },
  { key: 'camera', label: 'camera', svg: S(`<rect x="16" y="34" width="68" height="44" rx="8" fill="#FFD6E0" stroke="#6B4F4F" stroke-width="3"/><path d="M38 34l6-8h12l6 8" fill="#FFD6E0" stroke="#6B4F4F" stroke-width="3"/><circle cx="50" cy="56" r="13" fill="#fff" stroke="#6B4F4F" stroke-width="3"/><circle cx="50" cy="56" r="6" fill="#FF8FAB"/>`) },
  { key: 'peace', label: 'peace', svg: S(`<circle cx="50" cy="50" r="34" fill="#fff" stroke="#6B4F4F" stroke-width="3"/><path d="M50 16v68M50 50 26 74M50 50l24 24" fill="none" stroke="#6B4F4F" stroke-width="3"/>`) },
  { key: 'kiss', label: 'kiss', svg: S(`<path d="M50 40c-6-12-30-8-30 8 0 14 30 30 30 30s30-16 30-30c0-16-24-20-30-8z" fill="#FF6B93" stroke="#6B4F4F" stroke-width="3"/><path d="M40 44c4 4 6 4 10 0M50 44c4 4 6 4 10 0" fill="none" stroke="#6B4F4F" stroke-width="2"/>`) },
  { key: 'ghost', label: 'boo', svg: S(`<path d="M28 84V44a22 22 0 0144 0v40l-9-8-9 8-9-8-9 8z" fill="#fff" stroke="#6B4F4F" stroke-width="3"/><circle cx="42" cy="46" r="3" fill="#6B4F4F"/><circle cx="58" cy="46" r="3" fill="#6B4F4F"/><circle cx="38" cy="56" r="4" fill="#FFD6E0"/><circle cx="62" cy="56" r="4" fill="#FFD6E0"/>`) },
];

export function StickerSvg({ def, size = 44 }: { def: StickerDef; size?: number }): ReactElement {
  return <span style={{ width: size, height: size, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: def.svg }} />;
}

export const stickerDataUrl = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const getSticker = (key: string) => STICKERS.find((s) => s.key === key);
