/**
 * One-shot creative generator for a given CV — routed through GATHOS.
 * Copy (Gemini text) → text-free editorial background (Gathos t2i) → zero-typo overlay.
 *
 *   GEMINI_KEY=... npx tsx --env-file=.env.local scripts/make-creative.ts
 */
import fs from "fs/promises";
import path from "path";
import { generateLinkedInPosts } from "../src/lib/gemini";
import { buildStyledPrompt } from "../src/lib/image-prompt";
import { generateBackground } from "../src/lib/image-engine";
import { composeCard } from "../src/lib/compose";

const GEMINI_KEY = process.env.GEMINI_KEY!;

const profileContext = `# CREATOR PROFILE

**Name:** Urvashi Gupta
**Title:** Chartered Accountant | Internal Audit, Forensic & Due-Diligence Professional
**Location:** Mumbai, India
**Experience:** 4 years in internal audit and investigative procedures across FMCG,
manufacturing, logistics, ports, automotive, textiles and IT.

**Real, verifiable achievements (use these — never invent numbers):**
- Improved inventory accuracy by ~25% through enhanced verification/validation protocols.
- Concurrent (real-time) control audits in iron & steel that contributed to a 25% reduction
  in purchase-order issues.
- Factory-level audits for FMCG/food (production, dispatch, inventory reconciliation).
- Currently at Eide Bailly on US Employee Benefit Plan (401k) audits — substantive testing,
  walkthroughs, testing controls for design & operating effectiveness.
- Prior: Grant Thornton Bharat, Singhi & Co. (Moore Global). Audi/MG dealerships, ports,
  textile & polyester, auto components; P2P, O2C, HRMS, revenue, related-party, IRN.
- ICAI CA Final qualified (Sep 2025). GMCS best-presenter (1st).

**Voice:** precise, grounded, quietly authoritative — an auditor who has seen where money
actually leaks. No fluff, no motivational filler.`;

const topic =
  "What 4 years of internal audit taught me about where companies actually lose money — " +
  "it is almost never dramatic fraud, it is quiet, broken controls that no one owns. " +
  "Ground it in real fieldwork and the concrete wins from my CV (25% inventory-accuracy gain, " +
  "25% fewer PO issues). Make finance leaders, founders and fellow CAs rethink one control today.";

async function main() {
  console.log("→ Copy (Gemini text, app system prompt)…");
  const posts = await generateLinkedInPosts({
    apiKey: GEMINI_KEY,
    topic,
    postType: "text",
    postsCount: 1,
    industry: "Audit, Assurance & Finance",
    targetAudience: "CFOs, finance controllers, founders, fellow Chartered Accountants",
    tonePrefs: "grounded, specific, quietly authoritative; premium ghostwriter quality",
    profileContext,
  });
  const post = posts[0];
  console.log("HOOK:", post.hook);

  const styleId = "authority-quote";
  const { prompt, width, height, styleName, overlay } = buildStyledPrompt(
    {
      hook: post.hook,
      hookCategory: "Internal Audit", // clean topical eyebrow (not the raw "A. Bold/…" archetype)
      topic: "internal audit & financial controls",
      industry: "Audit, Assurance & Finance",
      cta: post.cta,
      author: "Urvashi Gupta",
    },
    styleId
  );

  console.log(`→ Background via GATHOS — style: ${styleName} ${width}x${height}…`);
  const img = await generateBackground({ prompt, width, height, geminiKey: GEMINI_KEY, quality: "pro" });
  console.log("  engine:", img.model, img.elapsedMs ? `(${img.elapsedMs}ms)` : "");

  let outBuf: Buffer = img.buffer;
  if (overlay?.text) {
    console.log("→ Overlay (zero-typo)…");
    outBuf = await composeCard(img.buffer, { width, height, text: overlay.text, theme: overlay.theme });
  }

  const outDir = path.join(process.cwd(), "out");
  await fs.mkdir(outDir, { recursive: true });
  const imgPath = path.join(outDir, "urvashi-gathos-creative.png");
  await fs.writeFile(imgPath, outBuf);

  const full =
    post.hook + "\n\n" + post.body + "\n\n" +
    (post.hashtags || []).map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ") +
    `\n\n---\nCTA: ${post.cta}\nHook type: ${post.hookCategory}\nImage engine: ${img.model}\n`;
  await fs.writeFile(path.join(outDir, "urvashi-gathos-post.txt"), full);

  console.log("\n✓ Image:", imgPath, "(engine:", img.model + ")");
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
