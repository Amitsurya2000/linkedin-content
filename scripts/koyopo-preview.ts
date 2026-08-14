/**
 * Renders one slide per KOYOPO template, in both canvas ratios, to
 * public/koyopo-preview/. Use it to eyeball the design system after changing
 * tokens or layout maths — nothing here touches the database or any API.
 *
 *   npx tsx scripts/koyopo-preview.ts
 */
import fs from "fs/promises";
import path from "path";
import { renderSlide, type KoyopoSlide, type CanvasName } from "../src/lib/koyopo";
import { buildPptx } from "../src/lib/koyopo-pptx";

const slides: KoyopoSlide[] = [
  { template: "title", title: "The 1Cr+ Career OS", subtitle: "How senior operators cross the 40L ceiling", sectionTag: "START HERE", moduleTag: "Module 01" },
  { template: "divider", title: "The 40L Trap", sectionTag: "SECTION TWO" },
  { template: "quote", body: "You are not paid for the work you do. You are paid for the decisions you own.", subtitle: "— the whole deck in one line" },
  {
    template: "cardGrid", title: "Four shifts that unlock the next tier", sectionTag: "POSITIONING",
    items: [
      "Visibility Audit — list every project your skip-level never heard about.",
      "Metric Swap — trade CSAT reporting for margin and retention reporting.",
      "Room Access — get into the forecast meeting, not the review meeting.",
      "Proof Library — keep receipts for every number you claim.",
    ],
  },
  {
    template: "numbered", title: "The five-step reposition", sectionTag: "THE METHOD",
    items: [
      "Map the money — find which line of the P&L your work moves.",
      "Rename the work — describe outcomes, never activities.",
      "Find the sponsor — one level above your manager.",
      "Ship a proof — one measurable win inside 90 days.",
      "Ask in their language — margin, risk, retention.",
    ],
  },
  {
    template: "twoColumn", title: "Two ways to describe the same year", sectionTag: "BEFORE AND AFTER",
    columns: [
      { heading: "40L framing", items: ["Managed the support queue", "Improved CSAT by a few points", "Ran the weekly review"] },
      { heading: "1Cr framing", items: ["Cut churn in the enterprise tier", "Protected recurring revenue", "Owned the retention forecast"] },
    ],
  },
  { template: "bigStat", title: "The gap nobody names", stat: "6 yrs", statLabel: "AVERAGE TIME STUCK AT 40L", body: "Most of it spent doing excellent work that no decision-maker ever sees.", sectionTag: "THE COST" },
  {
    template: "timeline", title: "What the first quarter looks like", sectionTag: "ROADMAP",
    items: [
      "Week 1 — audit every project against the P&L.",
      "Week 4 — rewrite your scope in outcome language.",
      "Week 8 — secure one sponsor above your manager.",
      "Week 12 — present one measurable win.",
    ],
  },
  {
    template: "worksheet", title: "Write these down before you continue", sectionTag: "YOUR TURN",
    items: [
      "Which number in the P&L does your work actually move?",
      "Who two levels up could name one thing you shipped?",
      "What proof do you have that you could show tomorrow?",
    ],
  },
  {
    template: "templateCard", title: "The message that gets the meeting", sectionTag: "SCRIPT",
    body: "**Subject: 15 minutes on retention**\nHi [Name] — I have been tracking why enterprise accounts churn in month nine.\nI have three findings and one fix that I think is worth your time.\n**Could I take 15 minutes next week?**",
  },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "koyopo-preview");
  await fs.mkdir(outDir, { recursive: true });

  for (const canvas of ["tall", "wide"] as CanvasName[]) {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const buf = await renderSlide(s, {
        canvas,
        deckTitle: "1Cr+ Career OS",
        pageNumber: i + 1,
        pageTotal: slides.length,
      });
      const name = `${canvas}-${String(i + 1).padStart(2, "0")}-${s.template}.png`;
      await fs.writeFile(path.join(outDir, name), buf);
      console.log(`${name}  ${(buf.length / 1024).toFixed(0)} KB`);
    }
  }
  console.log(`\nwrote ${slides.length * 2} slides to ${outDir}`);

  // Editable-deck path: same slide data, real text boxes instead of pixels.
  for (const canvas of ["wide", "tall"] as CanvasName[]) {
    const pptx = await buildPptx(slides, { canvas, deckTitle: "1Cr+ Career OS" });
    const file = path.join(outDir, `koyopo-deck-${canvas}.pptx`);
    await fs.writeFile(file, pptx);
    // A .pptx is a zip; "PK" confirms we produced a real archive, not junk.
    const magic = pptx.subarray(0, 2).toString("latin1");
    console.log(`koyopo-deck-${canvas}.pptx  ${(pptx.length / 1024).toFixed(0)} KB  zip-magic=${magic === "PK" ? "PK ✓" : "INVALID ✗"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
