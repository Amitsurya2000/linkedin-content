/**
 * Builds the carousel swipe file: renders one specimen per template in the
 * editorial style, then emits a self-contained HTML reference with the images
 * and the brand typeface inlined as data URIs.
 *
 * Self-contained matters — the published page runs under a CSP that blocks every
 * external host, so a linked font or image would silently fail.
 *
 *   npx tsx scripts/swipe-file.ts
 */
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { renderDeckSlide } from "../src/lib/deck-render";
import type { KoyopoSlide } from "../src/lib/koyopo";

interface Spec {
  slide: KoyopoSlide;
  name: string;
  use: string;
  shape: string;
  budget: string;
}

const SPECS: Spec[] = [
  {
    slide: { template: "title", title: "Your Edge Model Does Not Need INT8", subtitle: "What held up when the notebook became a deployed service", sectionTag: "PRODUCTION AI" },
    name: "Statement cover",
    use: "Slide 1, always. It carries about 80% of the outcome — if it does not stop the scroll, nothing after it is read.",
    shape: "State the payoff, not the topic. 3–6 words. One line of subtitle.",
    budget: "45 chars",
  },
  {
    slide: { template: "bigStat", title: "The number that ended the debate", stat: "0.6642", statLabel: "MAP50-95 AFTER FP16", body: "Baseline FP32 scored 0.6637. Quantizing to half precision cost nothing.", sectionTag: "THE PROOF" },
    name: "Big statistic",
    use: "Slide 2, to pay off the cover immediately. One number in a ring, carrying the whole slide.",
    shape: "A real figure, a caps label, one line of context. Never an invented number.",
    budget: "8 chars · label 30",
  },
  {
    slide: { template: "twoColumn", title: "Two ways to quantize the same model", sectionTag: "THE CONTRAST", columns: [
      { heading: "INT8", items: ["Needs a calibration dataset", "Typical 1.5 mAP accuracy drop", "Complex post-training pipeline"] },
      { heading: "ONNX FP16", items: ["No calibration dataset", "Accuracy held at 0.6642", "One-line export to CPU"] },
    ] },
    name: "Before / after",
    use: "Old way against new way, myth against reality. The highest-contrast layout in the set.",
    shape: "Equal bullet counts per column, or it reads lopsided. Grey ✗ left, colour ✓ right.",
    budget: "60 chars/bullet",
  },
  {
    slide: { template: "cardGrid", title: "Why demo code fails in production", sectionTag: "THE DELETED CODE", items: [
      "Stateless Loops — raw LLM calls fail without structured routing.",
      "Unbounded Context — loose prompts hallucinated under strain.",
      "INT8 Calibration — complex setup, no accuracy gain.",
      "Silent Fallbacks — errors swallowed instead of surfaced.",
    ] },
    name: "Card grid",
    use: "Three or four related ideas with room to explain each. The workhorse content slide.",
    shape: "Concept Name — one-sentence expansion. Em dash inside the first 60 characters.",
    budget: "110 chars/card",
  },
  {
    slide: { template: "iconGrid", title: "What actually ships to the edge", sectionTag: "THE STACK", items: [
      "ONNX Runtime", "FP16 Weights", "OpenCV Pipeline", "FastAPI Service", "Docker Image", "CPU Inference",
    ] },
    name: "Tile grid",
    use: "A menu of options or a category overview. Six or nine tiles — five looks broken.",
    shape: "Labels only, never sentences. Two to four words each.",
    budget: "24 chars/tile",
  },
  {
    slide: { template: "numbered", title: "The four-step edge deployment", sectionTag: "THE METHOD", items: [
      "Train the detector — 100 epochs on a custom Roboflow set.",
      "Export to ONNX — convert weights to FP16 half precision.",
      "Instrument the pipeline — overlay FPS and inference latency.",
      "Run on CPU — no GPU in the deployment target.",
    ] },
    name: "Numbered list",
    use: "Steps in order, ranked lists, frameworks. Numerals in filled colour circles.",
    shape: "Label — one supporting sentence. Four or five items.",
    budget: "110 chars/item",
  },
  {
    slide: { template: "timeline", title: "How the project actually ran", sectionTag: "ROADMAP", items: [
      "Week 1 — baseline FP32 model trained and scored.",
      "Week 2 — ONNX export path built and validated.",
      "Week 3 — FP16 quantization, accuracy re-measured.",
      "Week 4 — live webcam pipeline with latency overlays.",
    ] },
    name: "Process steps",
    use: "Sequences over time, pipelines, week-by-week plans. Stages connected down a rail.",
    shape: "Stage name — what happens. Four or five stages.",
    budget: "110 chars/stage",
  },
  {
    slide: { template: "quote", body: "Quantization is not the risk. Shipping a model nobody measured is the risk.", subtitle: "— the deck in one line", sectionTag: "THE TAKEAWAY" },
    name: "Pull quote",
    use: "Once per deck, in the back half, as a change of pace. Must be the single best sentence you have.",
    shape: "One line. If it is not quotable on its own, it is not a quote slide.",
    budget: "120 chars",
  },
  {
    slide: { template: "worksheet", title: "Check these before you deploy", sectionTag: "YOUR TURN", items: [
      "Have you measured accuracy after quantization, not just before?",
      "Does your latency number include preprocessing?",
      "Can the target machine run this without a GPU?",
    ] },
    name: "Checklist",
    use: "Takeaways, self-assessment, do-these-things. Alternating tinted rows with check marks.",
    shape: "Complete prompts the reader can act on. Three to five.",
    budget: "110 chars/row",
  },
  {
    slide: { template: "templateCard", title: "The export that does the work", sectionTag: "STEAL THIS", body: "**model.export(format=\"onnx\", half=True)**\nThat single flag is the whole FP16 path.\nNo calibration set. No quantization-aware retraining.\n**Measure mAP again afterwards — always.**" },
    name: "Script card",
    use: "Copy the reader can steal verbatim. Highest save rate of any layout.",
    shape: "Bold the line they should keep. This is the save-this-post slide.",
    budget: "4 lines",
  },
  {
    slide: { template: "divider", title: "What Held Up", sectionTag: "SECTION TWO" },
    name: "Section break",
    use: "A beat between major sections of a longer deck. Never two in a row.",
    shape: "Two or three words. No body copy.",
    budget: "25 chars",
  },
];

const STATS = [
  { figure: "3.7×", label: "Engagement vs text posts" },
  { figure: "8–10", label: "Slides, the measured sweet spot" },
  { figure: "80%", label: "Of the outcome sits on slide 1" },
  { figure: "20–30%", label: "Readers lost between slide 1 and 2" },
];

const RHYTHM = [
  ["Statement cover", "the payoff, not the topic"],
  ["Big statistic", "pay the promise off immediately"],
  ["Card grid", "the overview"],
  ["Before / after", "the contrast"],
  ["Section break", "a beat"],
  ["Numbered list", "the method"],
  ["Checklist", "what they do next"],
  ["Script card", "the thing they save"],
  ["Pull quote", "the call to action"],
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const root = process.cwd();

  // Brand typeface inlined. Two weights only — enough range for display and
  // labels without doubling the page weight.
  const fonts: Record<string, string> = {};
  for (const [key, file] of [["regular", "Poppins-Regular.ttf"], ["bold", "Poppins-Bold.ttf"]]) {
    const buf = await fs.readFile(path.join(root, "assets", "fonts", file));
    fonts[key] = buf.toString("base64");
  }

  // Specimens at 640px: sharp on a retina display at the size they are shown,
  // and a fraction of the weight of the full 1080px render.
  const cards: string[] = [];
  for (const spec of SPECS) {
    const full = await renderDeckSlide(spec.slide, { canvas: "tall", seed: "swipe-file", deckTitle: "Swipe file" });
    const small = await sharp(full).resize(640).png({ quality: 90, compressionLevel: 9 }).toBuffer();
    const b64 = small.toString("base64");
    cards.push(`      <article class="spec">
        <figure class="spec__shot">
          <img src="data:image/png;base64,${b64}" alt="${esc(spec.name)} template example" width="640" height="800" loading="lazy" />
        </figure>
        <div class="spec__meta">
          <h3 class="spec__name">${esc(spec.name)}</h3>
          <p class="spec__use">${esc(spec.use)}</p>
          <dl class="spec__rows">
            <dt>Copy shape</dt><dd>${esc(spec.shape)}</dd>
            <dt>Budget</dt><dd class="num">${esc(spec.budget)}</dd>
          </dl>
        </div>
      </article>`);
    console.log(`  rendered ${spec.name} — ${(small.length / 1024).toFixed(0)} KB`);
  }

  const html = `<title>LinkedIn Carousel Swipe File</title>
<style>
  @font-face { font-family: "Poppins"; font-weight: 400; font-style: normal; font-display: swap;
    src: url(data:font/ttf;base64,${fonts.regular}) format("truetype"); }
  @font-face { font-family: "Poppins"; font-weight: 700; font-style: normal; font-display: swap;
    src: url(data:font/ttf;base64,${fonts.bold}) format("truetype"); }

  /* Light is the base palette; the two blocks below redefine only tokens. */
  :root {
    --paper: #FCFBFB;
    --surface: #FFFFFF;
    --ink: #17161A;
    --muted: #6E6A6C;
    --rule: #E8E4E4;
    --accent: #ED383B;
    --accent-wash: #FDF0F0;
    --display: "Poppins", system-ui, sans-serif;
    --body: Georgia, "Iowan Old Style", "Times New Roman", serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --measure: 64ch;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #131214; --surface: #1B1A1D; --ink: #F2F0F0; --muted: #9A9497;
      --rule: #2C2A2D; --accent: #FF4E51; --accent-wash: #2A1618;
    }
  }
  :root[data-theme="dark"] {
    --paper: #131214; --surface: #1B1A1D; --ink: #F2F0F0; --muted: #9A9497;
    --rule: #2C2A2D; --accent: #FF4E51; --accent-wash: #2A1618;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: var(--body); font-size: 17px; line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: clamp(2rem, 5vw, 4.5rem) clamp(1.1rem, 4vw, 2.5rem) 5rem; }

  .eyebrow {
    font-family: var(--display); font-weight: 700; font-size: .68rem;
    letter-spacing: .16em; text-transform: uppercase; color: var(--accent); margin: 0 0 .9rem;
  }
  h1 {
    font-family: var(--display); font-weight: 700; font-size: clamp(2.1rem, 5.5vw, 3.4rem);
    line-height: 1.04; letter-spacing: -.02em; margin: 0 0 1rem; text-wrap: balance;
  }
  .lede { max-width: var(--measure); color: var(--muted); font-size: 1.06rem; margin: 0; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px;
    background: var(--rule); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; margin: 2.75rem 0 0; }
  .stat { background: var(--surface); padding: 1.15rem 1.2rem; }
  .stat__figure { font-family: var(--display); font-weight: 700; font-size: 1.55rem;
    font-variant-numeric: tabular-nums; letter-spacing: -.01em; display: block; }
  .stat__label { font-family: var(--display); font-size: .74rem; color: var(--muted); line-height: 1.35; display: block; margin-top: .3rem; }

  h2 {
    font-family: var(--display); font-weight: 700; font-size: 1.42rem; letter-spacing: -.01em;
    margin: 4.5rem 0 .5rem; padding-top: 1.4rem; border-top: 2px solid var(--ink);
  }
  .section-note { color: var(--muted); max-width: var(--measure); margin: 0 0 2rem; font-size: .97rem; }

  .specs { display: flex; flex-direction: column; gap: 2.5rem; }
  .spec { display: grid; grid-template-columns: 280px 1fr; gap: 2rem; align-items: start; }
  .spec__shot { margin: 0; border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--surface); }
  .spec__shot img { display: block; width: 100%; height: auto; }
  .spec__name { font-family: var(--display); font-weight: 700; font-size: 1.16rem; margin: 0 0 .5rem; }
  .spec__use { margin: 0 0 1.1rem; max-width: var(--measure); }
  .spec__rows { display: grid; grid-template-columns: max-content 1fr; gap: .45rem 1.1rem; margin: 0;
    padding-top: 1rem; border-top: 1px solid var(--rule); }
  .spec__rows dt { font-family: var(--display); font-weight: 700; font-size: .7rem;
    letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding-top: .18rem; }
  .spec__rows dd { margin: 0; font-size: .95rem; }
  .num { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: .87rem; }

  .rhythm { list-style: none; margin: 0; padding: 0; counter-reset: r;
    border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }
  .rhythm li { counter-increment: r; display: grid; grid-template-columns: 2.4rem max-content 1fr;
    gap: 1rem; align-items: baseline; padding: .78rem 1.15rem; background: var(--surface); }
  .rhythm li + li { border-top: 1px solid var(--rule); }
  .rhythm li::before { content: counter(r); font-family: var(--mono); font-size: .82rem; color: var(--accent); font-weight: 700; }
  .rhythm b { font-family: var(--display); font-weight: 700; font-size: .95rem; }
  .rhythm span { color: var(--muted); font-size: .93rem; }

  .rules { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); }
  .rule-card { background: var(--accent-wash); border: 1px solid var(--rule); border-radius: 10px; padding: 1.35rem 1.45rem; }
  .rule-card h3 { font-family: var(--display); font-weight: 700; font-size: 1.02rem; margin: 0 0 .55rem; }
  .rule-card p { margin: 0 0 .7rem; font-size: .96rem; }
  .rule-card p:last-child { margin-bottom: 0; }
  .swap { font-family: var(--mono); font-size: .83rem; display: block; padding: .3rem 0; }
  .swap.bad { color: var(--muted); text-decoration: line-through; }
  .swap.good { color: var(--accent); font-weight: 700; }

  footer { margin-top: 4.5rem; padding-top: 1.4rem; border-top: 1px solid var(--rule); color: var(--muted); font-size: .87rem; }
  footer ul { margin: .6rem 0 0; padding-left: 1.1rem; }
  footer a { color: inherit; }
  a:focus-visible, .rhythm li:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

  @media (max-width: 720px) {
    .spec { grid-template-columns: 1fr; gap: 1.2rem; }
    .spec__shot { max-width: 300px; }
    .rhythm li { grid-template-columns: 1.8rem 1fr; }
    .rhythm span { grid-column: 2; }
  }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Carousel reference</p>
    <h1>Eleven templates that earn the swipe</h1>
    <p class="lede">
      Every layout below is drawn from carousels that actually perform on LinkedIn, paired with
      the copy shape it needs and the character budget it holds. Pick the pattern that fits the
      idea — a deck that alternates layouts reads as designed, a deck of eight identical card
      grids reads as a text dump.
    </p>
    <div class="stats">
      ${STATS.map((s) => `<div class="stat"><span class="stat__figure">${s.figure}</span><span class="stat__label">${esc(s.label)}</span></div>`).join("\n      ")}
    </div>
  </header>

  <h2>The two rules that decide everything</h2>
  <p class="section-note">
    Both fall out of the same measurement: readers leave early, and they leave for a reason.
  </p>
  <div class="rules">
    <div class="rule-card">
      <h3>The cover states the payoff, not the topic</h3>
      <p>Weak covers name the subject. Strong covers name what the reader gets, which is what opens the curiosity gap.</p>
      <span class="swap bad">Edge Deployment and Quantization</span>
      <span class="swap good">Your Edge Model Does Not Need INT8</span>
    </div>
    <div class="rule-card">
      <h3>Slide 2 pays the promise off immediately</h3>
      <p>Never spend slide 2 on background or a contents list. Deliver the proof — the number, the contrast, the answer.</p>
      <p>Between a fifth and a third of readers leave right here. If the payoff waits until slide 5, most of them are already gone.</p>
    </div>
  </div>

  <h2>The eleven templates</h2>
  <p class="section-note">
    Specimens are rendered at the real 4:5 ratio LinkedIn favours, from the same engine that
    produces the decks.
  </p>
  <div class="specs">
${cards.join("\n")}
  </div>

  <h2>Deck rhythm</h2>
  <p class="section-note">
    A nine-slide shape that alternates by design. Never repeat a template back to back, and keep
    colour-panel slides to punctuation — at most two besides the cover.
  </p>
  <ol class="rhythm">
    ${RHYTHM.map(([n, why]) => `<li><b>${esc(n)}</b><span>${esc(why)}</span></li>`).join("\n    ")}
  </ol>

  <footer>
    <p>Benchmarks current as of August 2026.</p>
    <ul>
      <li><a href="https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/">Oktopost — carousel best practices and B2B benchmark</a></li>
      <li><a href="https://www.morphica.studio/blog/linkedin-carousel-best-practices-2026">Morphica — what drives carousel engagement in 2026</a></li>
      <li><a href="https://usevisuals.com/blog/linkedin-carousel-engagement-statistics-2026">UseVisuals — engagement statistics and slide-count analysis</a></li>
      <li><a href="https://postory.io/blog/linkedin-carousels-guide">Postory — carousels versus text posts</a></li>
      <li><a href="https://www.trymypost.com/blog/linkedin-pdf-carousel-design-guide-2026">TryMyPost — PDF carousel design guide and typography minimums</a></li>
    </ul>
  </footer>
</div>
`;

  const out = path.join(root, "public", "swipe-file.html");
  await fs.writeFile(out, html, "utf8");
  console.log(`\nwrote ${out} — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
