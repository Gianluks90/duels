#!/usr/bin/env node
// Rigenera gli asset serviti in public/ a partire dai master ad alta risoluzione in
// assets-source/ — quest'ultima cartella non viene mai deployata (angular.json include solo
// public/**/*), quindi qui possono restare a piena risoluzione senza pesare sul bundle.
//
// Uso: droppa una nuova immagine in una qualunque sottocartella di assets-source/ (es.
// assets-source/spells/fire_bolt.png per una futura arte di incantesimo) e lancia
// `npm run images:optimize` — lo script mirror-a automaticamente la stessa sottocartella dentro
// public/, convertendo in WebP. Rilancialo anche dopo aver aggiornato un master esistente: i file
// già aggiornati (mtime output >= mtime sorgente) vengono saltati.
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, relative, dirname, extname, basename } from 'node:path';
import sharp from 'sharp';

const SOURCE_ROOT = 'assets-source';
const OUTPUT_ROOT = 'public';
const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
// Nessuna carta/arte viene mai renderizzata oltre ~170px di larghezza nell'app attuale (vedi
// board.component.ts, home.component.ts) — 480 lascia margine per schermi ad alta densità (~2.85x)
// senza portarsi dietro la risoluzione dei master (spesso 900px+), che pesa senza alcun beneficio
// visivo reale.
const MAX_WIDTH = 480;
const QUALITY = 82;

async function findSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findSourceFiles(fullPath)));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function isUpToDate(sourcePath, outputPath) {
  try {
    const [sourceStat, outputStat] = await Promise.all([stat(sourcePath), stat(outputPath)]);
    return outputStat.mtimeMs >= sourceStat.mtimeMs;
  } catch {
    return false; // outputPath non esiste ancora
  }
}

async function optimizeOne(sourcePath) {
  const relPath = relative(SOURCE_ROOT, sourcePath);
  const outputPath = join(OUTPUT_ROOT, dirname(relPath), `${basename(relPath, extname(relPath))}.webp`);

  if (await isUpToDate(sourcePath, outputPath)) {
    return { relPath, skipped: true };
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const before = (await stat(sourcePath)).size;
  await sharp(sourcePath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outputPath);
  const after = (await stat(outputPath)).size;

  return { relPath, skipped: false, before, after };
}

async function main() {
  const sourceFiles = await findSourceFiles(SOURCE_ROOT);
  if (sourceFiles.length === 0) {
    console.log(`Nessuna immagine trovata in ${SOURCE_ROOT}/.`);
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let converted = 0;
  let skipped = 0;

  for (const sourcePath of sourceFiles) {
    const result = await optimizeOne(sourcePath);
    if (result.skipped) {
      skipped++;
      console.log(`= ${result.relPath} (già aggiornato)`);
      continue;
    }
    converted++;
    totalBefore += result.before;
    totalAfter += result.after;
    const savedPct = Math.round((1 - result.after / result.before) * 100);
    console.log(
      `✓ ${result.relPath} — ${(result.before / 1024).toFixed(0)}KB → ${(result.after / 1024).toFixed(0)}KB (-${savedPct}%)`,
    );
  }

  console.log(`\n${converted} convertite, ${skipped} già aggiornate.`);
  if (converted > 0) {
    const savedPct = Math.round((1 - totalAfter / totalBefore) * 100);
    console.log(
      `${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB (-${savedPct}%)`,
    );
  }
}

main();
