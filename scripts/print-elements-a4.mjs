#!/usr/bin/env node
// Genera un foglio A4 (300 DPI, senza abbondanza) con le carte elemento base pronte da ritagliare
// direttamente in casa — nessuno spazio tra una carta e l'altra: il taglio si fa esattamente dove
// due carte si toccano, più dei piccoli segni a L nei margini esterni per allineare il righello.
//
// Riusa le stesse proporzioni di badge di card.component.scss (mana in alto a sinistra, elemento
// in basso a destra) e l'arte ad alta risoluzione in assets-source/cards/ (non i WebP da 480px di
// public/cards/, troppo piccoli per la stampa).
//
// Uso: npm run cards:elements-a4  →  scrive print/a4-elementi-base.png
// Per un mazzo diverso (altri elementi/copie), modifica ORDER qui sotto.
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'print/a4-elementi-base.png');

const cinzel = opentype.parse((await readFile(join(ROOT, 'scripts/fonts/Cinzel.ttf'))).buffer);

const DPI = 300;
const mm = (v) => Math.round((v * DPI) / 25.4);

// Carta — dimensione di taglio esatta (formato poker), senza abbondanza: le carte si toccano.
const CARD_W = mm(63);
const CARD_H = mm(88);

const PAGE_W = mm(210);
const PAGE_H = mm(297);

const COLS = 3; // floor(210/63) — il massimo che ci sta
const ROWS = 3; // floor(297/88) — il massimo che ci sta
const GRID_W = COLS * CARD_W;
const GRID_H = ROWS * CARD_H;
const MARGIN_X = Math.round((PAGE_W - GRID_W) / 2);
const MARGIN_Y = Math.round((PAGE_H - GRID_H) / 2);

const ELEMENT_MANA = { fire: 1, water: 1, air: 1, earth: 1 };
const ELEMENT_ICONS = {
  fire: 'local_fire_department_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  water: 'water_drop_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  air: 'air_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  earth: 'eco_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
};

// 2 copie di ciascun elemento base, in 8 delle 9 celle della griglia — l'ultima resta bianca
// (4 elementi x 2 non riempie esattamente una griglia 3x3: si ritaglia e si scarta).
const ORDER = ['fire', 'fire', 'water', 'water', 'air', 'air', 'earth', 'earth', null];

async function iconPaths(file) {
  const svg = await readFile(join(ROOT, 'public/icons', file), 'utf8');
  return [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)].map((m) => m[1]);
}

async function icon(file, x, y, size, color) {
  const paths = (await iconPaths(file)).map((d) => `<path d="${d}"/>`).join('');
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="${color}">${paths}</svg>`;
}

function badge(cx, cy, d) {
  return `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="#212121" filter="url(#badgeShadow)"/>`;
}

/** Badge mana + elemento (angoli della carta, stesso layout di card.component.scss), a dimensione di taglio esatta, senza abbondanza. */
async function overlay(element) {
  const parts = [];

  // Mana — in alto a sinistra, inset 3%, diametro 30% della larghezza carta.
  const manaD = Math.round(CARD_W * 0.3);
  const inset = Math.round(CARD_W * 0.03);
  const mana = ELEMENT_MANA[element];
  const cx = inset + manaD / 2;
  const cy = inset + manaD / 2;
  const fs = Math.round(manaD * 0.62);
  parts.push(badge(cx, cy, manaD));
  // Il glifo Cinzel va convertito in tracciato: librsvg non vede i font di sistema/Google Fonts.
  const probe = cinzel.getPath(String(mana), 0, 0, fs).getBoundingBox();
  const x = cx - (probe.x1 + probe.x2) / 2;
  const y = cy - (probe.y1 + probe.y2) / 2;
  const d = cinzel.getPath(String(mana), x, y, fs).toPathData(2);
  parts.push(
    `<path d="${d}" fill="#2f7fd0" stroke="#8fd0ff" stroke-width="${(fs * 0.06).toFixed(1)}" filter="url(#digitShadow)"/>`,
  );

  // Elemento — in basso a destra, inset 3%, diametro 42% della larghezza carta.
  const elD = Math.round(CARD_W * 0.42);
  const elX = CARD_W - inset - elD;
  const elY = CARD_H - inset - elD;
  parts.push(badge(elX + elD / 2, elY + elD / 2, elD));
  const pad = elD * 0.2;
  parts.push(await icon(ELEMENT_ICONS[element], elX + pad, elY + pad, elD - 2 * pad, '#e8eaed'));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
  <defs>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${mm(0.25)}" stdDeviation="${mm(0.35)}" flood-color="#000" flood-opacity="0.5"/>
    </filter>
    <filter id="digitShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="${mm(0.5)}" flood-color="#000" flood-opacity="0.9"/>
      <feDropShadow dx="0" dy="${mm(0.2)}" stdDeviation="${mm(0.25)}" flood-color="#000" flood-opacity="0.85"/>
    </filter>
  </defs>
  ${parts.join('\n  ')}
</svg>`;
}

async function renderCard(element) {
  const art = await sharp(join(ROOT, 'assets-source/cards', `${element}.png`))
    .resize(CARD_W, CARD_H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .toBuffer();
  const svg = Buffer.from(await overlay(element));
  return sharp(art).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
}

/** Segni di taglio nei margini della pagina — mai sopra una carta — su ogni linea della griglia. */
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

const composites = [];
for (let i = 0; i < ORDER.length; i++) {
  const element = ORDER[i];
  if (!element) continue;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const input = await renderCard(element);
  composites.push({ input, left: MARGIN_X + col * CARD_W, top: MARGIN_Y + row * CARD_H });
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
  `A4 ${PAGE_W}x${PAGE_H}px @ ${DPI} DPI — griglia ${COLS}x${ROWS}, carte ${CARD_W}x${CARD_H}px (63x88mm, senza abbondanza)`,
);
console.log(
  `Alla stampa: disattiva "adatta alla pagina"/scala automatica e stampa a dimensioni reali (100%).`,
);
