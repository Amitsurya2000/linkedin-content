/**
 * Renders every banner theme against a sample brief, so the 1584×396 layout can
 * be checked without generating one through the app.
 *
 *   npx tsx scripts/banner-preview.ts
 */
import fs from "fs/promises";
import path from "path";
import { renderBanner, BANNER_THEMES, type BannerThemeName, type BannerVisual } from "../src/lib/banner";

const BRIEF = {
  tagline: "From Financial Data to Business Foresight",
  pillars: ["Financial Modeling", "Data Automation", "Risk Analytics"],
  name: "Alex Morgan",
  email: "alex.morgan@email.com",
};

async function main() {
  const outDir = path.join(process.cwd(), "public", "banner-preview");
  await fs.mkdir(outDir, { recursive: true });
  const visuals: BannerVisual[] = ["arc", "layers", "signal", "grid", "path"];

  let i = 0;
  for (const theme of Object.keys(BANNER_THEMES) as BannerThemeName[]) {
    const buf = await renderBanner({ ...BRIEF, visual: visuals[i % visuals.length] }, { theme, scale: 1 });
    await fs.writeFile(path.join(outDir, `${theme}.png`), buf);
    console.log(`${theme} (${visuals[i % visuals.length]})`);
    i++;
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
