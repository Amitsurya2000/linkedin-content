/**
 * Smoke-renders the free asset renderers and the video encoder, so each one is
 * proven to produce a real file before it is used through the UI.
 *
 *   npx tsx scripts/assets-preview.ts
 */
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { renderCover, renderProfilePhoto, ASSET_THEMES, type AssetThemeName } from "../src/lib/asset-render";
import { renderSwipeDeck } from "../src/lib/deck-swipe";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";
import { renderDeckVideo, ffmpegAvailable } from "../src/lib/deck-video";

const SLIDES: RawSlide[] = [
  { slideTemplate: "title", title: "Close the books in *36 hours*", body: "What changed when I stopped treating the calendar as fixed." },
  { slideTemplate: "cardGrid", title: "Nobody had timed the steps", takeaway: "Close time is not a constraint. It is an unexamined habit.", body: "I inherited a 5-day close and assumed that was how long it took.\nWe were reconciling three currencies by hand, every month.\nTwo weekends of VBA later it ran itself." },
  { slideTemplate: "divider", title: "Follow for more", body: "Want the template?" },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "assets-preview");
  await fs.mkdir(outDir, { recursive: true });

  // 1. Covers, every theme.
  for (const theme of Object.keys(ASSET_THEMES) as AssetThemeName[]) {
    const png = await renderCover(
      { kicker: "CASE STUDY", headline: "5 days to 36 hours", sub: "How one VBA macro rewrote our month-end close.", footer: "Alex Morgan" },
      { theme, size: "featured", scale: 1 }
    );
    await fs.writeFile(path.join(outDir, `cover-${theme}.png`), png);
  }
  console.log(`covers: ${Object.keys(ASSET_THEMES).length}`);

  // 2. Profile photo — synthesised stand-in, since there is no headshot in the repo.
  const fake = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: { r: 190, g: 175, b: 160 } },
  }).composite([{
    input: Buffer.from(`<svg width="900" height="1200"><circle cx="450" cy="430" r="200" fill="#8a7a68"/><rect x="230" y="640" width="440" height="560" rx="200" fill="#6f6152"/></svg>`),
    left: 0, top: 0,
  }]).png().toBuffer();

  for (const style of ["ring", "halo", "duotone", "plain"] as const) {
    const png = await renderProfilePhoto(fake, { theme: "navy", style });
    await fs.writeFile(path.join(outDir, `photo-${style}.png`), png);
  }
  console.log("profile photos: 4");

  // 3. Video.
  if (await ffmpegAvailable()) {
    const frames = await renderSwipeDeck(toKoyopoSlides(SLIDES), { canvas: "tall", theme: "slate", author: "Alex Morgan" });
    const mp4 = await renderDeckVideo(frames, { secondsPerSlide: 2.5, fadeSeconds: 0.4 });
    await fs.writeFile(path.join(outDir, "deck.mp4"), mp4);
    console.log(`video: ${frames.length} slides -> ${(mp4.length / 1024).toFixed(0)} KB mp4`);
  } else {
    console.log("video: SKIPPED (no ffmpeg)");
  }

  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
