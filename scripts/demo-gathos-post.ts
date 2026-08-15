/**
 * Demo: generate real LinkedIn post visuals through the live pipeline
 * (buildStyledPrompt -> Gathos background -> composeCard overlay), using the
 * server Gathos key from .env.local.
 *
 *   npx tsx --env-file=.env.local scripts/demo-gathos-post.ts
 *
 * Two different resume-derived personas are rendered to prove the output is
 * personalized per resume (hook, topic, author sign-off all differ).
 */
import fs from "fs/promises";
import path from "path";
import { buildStyledPrompt } from "../src/lib/image-prompt";
import { composeCard } from "../src/lib/compose";
import { generateBackground } from "../src/lib/image-engine";

interface Persona {
  label: string;
  styleId: string;
  input: {
    hook: string;
    hookCategory?: string;
    topic?: string;
    industry?: string;
    cta?: string;
    author?: string;
  };
}

// Two distinct "resumes" -> two distinct posts + visuals.
const PERSONAS: Persona[] = [
  {
    label: "fintech-product-leader",
    styleId: "charcoal-gold",
    input: {
      hook: "I killed our most-requested feature. Retention went up 22%.",
      hookCategory: "contrarian",
      topic: "product strategy and saying no",
      industry: "fintech",
      cta: "Follow for more product lessons",
      author: "Priya Nair",
    },
  },
  {
    label: "b2b-sales-leader",
    styleId: "executive-navy",
    input: {
      hook: "We stopped chasing enterprise logos. Revenue doubled in 9 months.",
      hookCategory: "story",
      topic: "focus and ICP in B2B sales",
      industry: "SaaS sales",
      cta: "Follow for GTM playbooks",
      author: "Arjun Mehta",
    },
  },
];

async function main() {
  const outDir = path.join(process.cwd(), "out");
  await fs.mkdir(outDir, { recursive: true });

  for (const p of PERSONAS) {
    console.log(`\n=== ${p.label} (style: ${p.styleId}) ===`);
    const { prompt, width, height, styleName, overlay } = buildStyledPrompt(p.input, p.styleId);
    console.log(`style: ${styleName} | ${width}x${height}`);

    const t0 = Date.now();
    const img = await generateBackground({ prompt, width, height });
    console.log(`background: ${img.model} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    let out = img.buffer;
    if (overlay?.text) {
      out = await composeCard(out, { width, height, text: overlay.text, theme: overlay.theme });
    }

    const file = path.join(outDir, `demo-${p.label}.png`);
    await fs.writeFile(file, out);
    console.log(`saved: ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
