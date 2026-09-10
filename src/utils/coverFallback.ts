import { seededUnit } from './hash';

/**
 * When a cover is missing or fails to load we generate one rather than showing
 * a broken image. Returns a data URL so it needs no network and can be used as
 * both an <img> src and a three.js texture.
 */
const PALETTE: [string, string][] = [
  ['#3b2a20', '#7a5c42'],
  ['#22303a', '#4b6b7a'],
  ['#2f2438', '#6b4f7a'],
  ['#2b3327', '#5c7a4f'],
  ['#3a2427', '#7a4b52'],
  ['#332d20', '#7a6c42'],
];

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

const wrap = (text: string, perLine: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > perLine && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
    if (lines.length === maxLines) break;
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trim());
  return lines;
};

export const generatedCover = (title: string, author = '', seed = title): string => {
  const [dark, light] = PALETTE[Math.floor(seededUnit(seed, 'palette') * PALETTE.length)]!;
  const titleLines = wrap(title, 16, 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)"/>
  <rect x="26" y="26" width="348" height="548" fill="none" stroke="rgba(255,240,220,0.35)" stroke-width="2"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#f6ecdd" text-anchor="middle">
    ${titleLines
      .map(
        (line, i) => `<text x="200" y="${250 + i * 42}" font-size="34">${escapeXml(line)}</text>`,
      )
      .join('\n    ')}
    ${author ? `<text x="200" y="${270 + titleLines.length * 42}" font-size="20" fill="rgba(246,236,221,0.75)">${escapeXml(author)}</text>` : ''}
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
