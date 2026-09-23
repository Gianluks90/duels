#!/usr/bin/env node
// Genera un foglio A4 (300 DPI, senza abbondanza) con 8 copie di un dorso (public/cards-back/,
// master in assets-source/cards-back/), stessa griglia/dimensioni di print-elements-a4.mjs così i
// due fogli combaciano per una stampa fronte-retro.
//
// La griglia 3x3 (9 celle) ne riempie solo 8, lasciando una cella bianca da ritagliare — vedi
// print-elements-a4.mjs. Quella cella nel foglio fronte cade in basso A DESTRA (ultima riga,
// ultima colonna, riempita per righe). Con la stampa fronte-retro standard (flip sul lato lungo,
// il default per pagine verticali), il retro esce specchiato orizzontalmente rispetto al fronte:
// una cella in basso a destra sul fronte finisce in basso a SINISTRA quando la sfogli. Per questo
// qui la colonna di ogni carta è rispecchiata (COLS - 1 - col) rispetto al foglio fronte — così la
// cella bianca risulta in basso a sinistra *in questo file*, e dopo la stampa fronte-retro atterra
// esattamente sotto quella del fronte invece di lasciare uno spazio vuoto disallineato.
//
// Uso: npm run cards:back-a4 -- <skin> [outFile]
//   npm run cards:back-a4 -- de-bug
//   npm run cards:back-a4 -- amber print/a4-dorso-amber.png
// <skin> è uno dei file in assets-source/cards-back/ (es. de-bug, amber, dark, wands...).
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const [skin, outArg] = process.argv.slice(2);
if (!skin) {
  console.error('Uso: npm run cards:back-a4 -- <skin> [outFile]');
  console.error('   es: npm run cards:back-a4 -- de-bug');
  process.exit(1);
}
const OUT_FILE = join(ROOT, outArg ?? `print/a4-dorso-${skin}.png`);

const DPI = 300;
const mm = (v) => Math.round((v * DPI) / 25.4);

const CARD_W = mm(63);
const CARD_H = mm(88);
const PAGE_W = mm(210);
const PAGE_H = mm(297);
const COLS = 3;
const ROWS = 3;
const GRID_W = COLS * CARD_W;
const GRID_H = ROWS * CARD_H;
const MARGIN_X = Math.round((PAGE_W - GRID_W) / 2);
const MARGIN_Y = Math.round((PAGE_H - GRID_H) / 2);

// 8 dorsi identici, come le 8 carte fronte di print-elements-a4.mjs.
const COUNT = 8;

function cropMarks() {
  const TICK = mm(3);
  const STROKE = Math.max(1, mm(0.15));
  const lines = [];
  for (let i = 0; i <= COLS; i++) {
    const x = MARGIN_X + i * CARD_W;
    lines.push(`<line x1="${x}" y1="${MARGIN_Y - TICK}" x2="${x}" y2="${MARGIN_Y}" />`);
    lines.push(
      `<line x1="${x}" y1="${MARGIN_Y + GRID_H}" x2="${x}" y2="${MARGIN_Y + GRID_H + TICK}" />`,
    );
  }
  for (let j = 0; j <= ROWS; j++) {
    const y = MARGIN_Y + j * CARD_H;
    lines.push(`<line x1="${MARGIN_X - TICK}" y1="${y}" x2="${MARGIN_X}" y2="${y}" />`);
    lines.push(
      `<line x1="${MARGIN_X + GRID_W}" y1="${y}" x2="${MARGIN_X + GRID_W + TICK}" y2="${y}" />`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}">
  <g stroke="#000" stroke-width="${STROKE}">${lines.join('')}</g>
</svg>`;
}

const sourcePath = join(ROOT, 'assets-source/cards-back', `${skin}.png`);
const backTile = await sharp(sourcePath)
  // 'fill' (non 'cover'): adatta l'intera immagine alla carta senza ritagliarla — il sorgente
  // (2:3) e la carta (63:88, leggermente più larga) non hanno le stesse proporzioni, quindi viene
  // un po' schiacciata sopra/sotto, ma niente viene tagliato via.
  .resize(CARD_W, CARD_H, { fit: 'fill', kernel: 'lanczos3' })
  .png()
  .toBuffer();

const composites = [];
for (let i = 0; i < COUNT; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const mirroredCol = COLS - 1 - col; // vedi commento in testa al file
  composites.push({
    input: backTile,
    left: MARGIN_X + mirroredCol * CARD_W,
    top: MARGIN_Y + row * CARD_H,
  });
}
composites.push({ input: Buffer.from(cropMarks()), left: 0, top: 0 });

await mkdir(dirname(OUT_FILE), { recursive: true });
await sharp({ create: { width: PAGE_W, height: PAGE_H, channels: 3, background: '#fff' } })
  .composite(composites)
  .withMetadata({ density: DPI })
  .png()
  .toFile(OUT_FILE);

console.log(`${OUT_FILE}`);
console.log(
  `A4 ${PAGE_W}x${PAGE_H}px @ ${DPI} DPI — griglia ${COLS}x${ROWS} (colonne specchiate), ${COUNT}x dorso "${skin}", carte ${CARD_W}x${CARD_H}px (63x88mm, senza abbondanza)`,
);
console.log(
  `Alla stampa: disattiva "adatta alla pagina"/scala automatica, stampa a dimensioni reali (100%), fronte-retro con flip sul lato lungo.`,
);
