/**
 * Renders the campaign (poster) style against sample copy.
 *
 *   npx tsx scripts/campaign-preview.ts [--theme=violet]
 */
import fs from "fs/promises";
import path from "path";
import { renderCampaignDeck, CAMPAIGN_THEMES, type CampaignThemeName } from "../src/lib/deck-campaign";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";

const SAMPLE: RawSlide[] = [
  { slideTemplate: "title", title: "Unlock the value of disabled talent", sectionTag: "Why?", body: "Inclusive hiring is a business advantage, not a favour." },
  { slideTemplate: "cardGrid", title: "Inclusive hiring strengthens teams, culture, and performance", sectionTag: "How?", takeaway: "Diverse teams make measurably better decisions." },
  { slideTemplate: "bigStat", title: "Teams that hire inclusively outperform their peers", sectionTag: "Proof", body: "Fresh perspectives change how decisions get made." },
  { slideTemplate: "divider", title: "Start with one role", sectionTag: "Contact us", body: "Rewrite the job description before you post it." },
];

async function main() {
  const themeArg = process.argv.find((a) => a.startsWith("--theme="))?.split("=")[1] as CampaignThemeName | undefined;
  const themes = themeArg ? [themeArg] : (Object.keys(CAMPAIGN_THEMES) as CampaignThemeName[]);
  const outDir = path.join(process.cwd(), "public", "campaign-preview");
  await fs.mkdir(outDir, { recursive: true });
  for (const theme of themes) {
    const bufs = await renderCampaignDeck(toKoyopoSlides(SAMPLE), { theme, brand: "Change 100" });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${theme}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${theme}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
