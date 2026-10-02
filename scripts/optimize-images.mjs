#!/usr/bin/env node
/**
 * Prepare photos in public/images for the web.
 *
 *   bun run images
 *
 * Every JPEG, PNG or oversized WebP in public/images becomes a WebP no longer
 * than 1600px on its long edge, plus an 800px copy (`name-800.webp`) that the
 * photo grids load first. Metadata, including any GPS position, is dropped.
 * The original JPEG or PNG is removed once its WebP exists, so update content
 * that pointed at the old name (the script prints each rename).
 */
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve(import.meta.dirname, "../public/images");
const FULL = 1600;
const SMALL = 800;

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/-800\.webp$/.test(f));

for (const file of files) {
  const source = path.join(DIR, file);
  const base = file.replace(/\.(jpe?g|png|webp)$/i, "");
  const full = path.join(DIR, `${base}.webp`);
  const small = path.join(DIR, `${base}-800.webp`);
  const input = await sharp(source).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(input).metadata();
  const isWebp = /\.webp$/i.test(file);

  if (!isWebp || Math.max(width, height) > FULL) {
    await sharp(input)
      .resize({ width: FULL, height: FULL, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(`${full}.tmp`);
    await rm(full, { force: true });
    await import("node:fs/promises").then((fs) => fs.rename(`${full}.tmp`, full));
    if (!isWebp) {
      await rm(source);
      console.log(`${file} → ${base}.webp`);
    }
  }

  const smallExists = await stat(small).then(() => true, () => false);
  if (!smallExists) {
    await sharp(input)
      .resize({ width: SMALL, height: SMALL, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(small);
  }
}

console.log(`${files.length} image(s) checked`);
