# CAROUSEL MASTER FILE — every carousel type, and how to build each one

The single source of truth for carousel generation. Compiled from published
carousel research (Buffer's example roundup, meet-lea's 15-template study,
Postpika's type catalogue, alpha.one's attention guide, Oktopost, Postory),
from real high-performing decks (Will McTighe, Justin Welsh, Jasmin Alić, Sahil
Bloom, Jay Clouse, Eddie Shleyner, Sam Browne, Alex Smith), and from the
renderer's own template set.

Read this WITH `koyopo-slide-rules.md` (character budgets) and
`carousel-design-patterns.md` (per-slide layout patterns). Where they disagree
on structure, this file wins; where they disagree on character counts, the
budgets win, because those are physical limits of the canvas.

---

## 0. WHY THE FORMAT IS WORTH DOING PROPERLY

Measured across published 2026 benchmarks:

| Metric | Carousel vs alternative |
|---|---|
| Engagement rate | 3.7× a text post |
| Reach | 1.8× a single-image post |
| Comments | 278% more than polls, 303% more than text |
| Saves | 5.2× other formats |
| Completion rate | ~36% average for a well-structured deck |

Industry split: creative/design decks average 8.2% engagement and 48%
completion; B2B SaaS averages 5.2% and 38%. Saves are the metric that compounds
— a saved deck keeps being opened weeks later, which is why **checklists and
cheat-sheets are the most-saved format on LinkedIn**.

**Specs.** 1080×1350 (4:5 portrait). 8–12 slides, 10 is the sweet spot. 20–40
words per slide, hard ceiling. Body type never below the equivalent of 32pt on
this canvas; hooks 60–100pt.

---

## 1. THE 18 CAROUSEL TYPES

Every deck should be ONE of these. Pick the type that fits the material — do not
blend two. Each entry gives the slide-by-slide spine at 10 slides and the
`slideTemplate` values that render it.

### 1. LISTICLE / RULES — "10 Rules to 10X Your Output"
The most reliable performer and the easiest to write. One point per slide.
- S1 `title` — numbered promise. Deliver exactly the count you name.
- S2–S9 `cardGrid` — one rule each: the rule as title, the confession as body, the principle as takeaway.
- S10 `divider` — CTA.
Use when: you have 5–10 parallel, independent points.

### 2. STEP-BY-STEP / HOW-TO — highest save rate of any format
- S1 `title` — "How to X (in 7 steps)".
- S2 `cardGrid` — the promise: what they will be able to do by slide 9.
- S3–S9 `numbered` or `timeline` — one sequential step each.
- S10 `divider` — CTA.
Use when: order matters and skipping a step breaks the result.

### 3. FRAMEWORK — "The 4C framework that closed $2M"
Naming a method makes it shareable and quotable. This is the strongest
positioning format for a job search: it says you think in systems.
- S1 `title` — name the framework.
- S2 `cardGrid` — origin: the problem that forced you to build it.
- S3–S6 `numbered` — one component per slide.
- S7 `cardGrid` — a real example running end to end.
- S8 `twoColumn` — where people get it wrong vs right.
- S9 `bigStat` — the outcome.
- S10 `divider` — CTA.

### 4. CASE STUDY (Problem → Action → Result)
- S1 `title` — the result as the hook.
- S2 `cardGrid` — the situation and the constraint.
- S3 `bigStat` — the number that defined the problem.
- S4–S7 `numbered` — the deliberate choices, not just the actions.
- S8 `bigStat` — the outcome number.
- S9 `quote` — what it proves.
- S10 `divider` — CTA.
Use when: you have a before number and an after number.

### 5. BEFORE / AFTER TRANSFORMATION
- S1 `title` — "From X to Y in Z".
- S2 `cardGrid` — the before state, honestly.
- S3 `cardGrid` — the turning point.
- S4–S7 `numbered` — the four changes.
- S8 `twoColumn` — before vs after, side by side.
- S9 `cardGrid` — the lesson that generalises.
- S10 `divider` — CTA.

### 6. MYTH-BUSTER — engagement through disagreement
- S1 `title` — "7 X myths that are costing you Y".
- S2–S9 `twoColumn` — myth on the left, reality on the right. One pair per slide.
- S10 `divider` — CTA.
Use when: your field has widely repeated advice you can disprove with evidence.

### 7. MISTAKES TO AVOID
- S1 `title` — "5 mistakes that are tanking your X".
- S2 `bigStat` — the stakes, quantified.
- S3–S7 `cardGrid` — one mistake each, with the fix inside the takeaway.
- S8 `templateCard` — the corrected version as a template.
- S9 `cardGrid` — how to check yourself.
- S10 `divider` — CTA.

### 8. CONTRARIAN / UNPOPULAR OPINION
- S1 `title` — the claim, flatly. "Unpopular opinion: X is dead."
- S2–S4 `cardGrid` — three pieces of evidence.
- S5 `bigStat` — the number that settles it.
- S6 `cardGrid` — why the old belief persisted.
- S7 `cardGrid` — the new rule.
- S8–S9 `numbered` — how to act on it.
- S10 `divider` — CTA.
Use sparingly. A contrarian deck with no evidence is just noise.

### 9. DATA STORY / RESEARCH RECAP
- S1 `title` — "I analysed N X. Here is what I found."
- S2 `cardGrid` — the method, in two lines. Credibility lives here.
- S3–S7 `bigStat` or bar-chart rows (`Label — 41`) — one finding each.
- S8 `cardGrid` — what it means for the reader.
- S9 `cardGrid` — the caveat. Naming a limitation raises trust.
- S10 `divider` — CTA.

### 10. COMPARISON — A vs B
- S1 `title` — "A vs B: the numbers no one shares".
- S2 `cardGrid` — why the choice matters.
- S3 `twoColumn` — setup of both options.
- S4–S6 `twoColumn` — one metric per slide, compared.
- S7 `cardGrid` — the insight the comparison reveals.
- S8–S9 `numbered` — how to choose.
- S10 `divider` — CTA.

### 11. Q&A / OBJECTION HANDLER
- S1 `title` — "The 8 questions every X asks me".
- S2 `cardGrid` — why you get asked.
- S3–S8 `worksheet` — question + answer, up to three pairs per slide.
- S9 `cardGrid` — the meta-answer behind all of them.
- S10 `divider` — CTA.

### 12. CHEAT SHEET / SWIPE FILE — most bookmarkable format
- S1 `title` — "The X cheat sheet (steal these 15 formulas)".
- S2 `cardGrid` — why these work.
- S3–S8 `iconGrid` or `worksheet` — 2–3 formulas per slide.
- S9 `cardGrid` — the pro tip that makes them land.
- S10 `divider` — CTA.

### 13. CHECKLIST — most-saved format on the platform
- S1 `title` — "The N-point X checklist".
- S2 `cardGrid` — when to run it.
- S3–S8 `worksheet` — checkable items, 4–5 per slide.
- S9 `cardGrid` — what a pass looks like.
- S10 `divider` — CTA.

### 14. LESSON FROM FAILURE
- S1 `title` — "I lost X. Here are the N lessons I paid for."
- S2 `cardGrid` — the setup, without self-flattery.
- S3–S9 `numbered` — one lesson each, each with what it cost.
- S10 `divider` — CTA.
The most emotionally shareable format. Requires a real failure, told plainly.

### 15. NARRATIVE JOURNEY
- S1 `title` — "From X to Y. My exact playbook."
- S2 `cardGrid` — the low point.
- S3 `cardGrid` — the insight that changed direction.
- S4–S8 `timeline` — five sequential moves, in order.
- S9 `cardGrid` — the lessons that transfer.
- S10 `divider` — CTA.

### 16. TACTICAL PLAYBOOK
- S1 `title` — "The X playbook that produces Y".
- S2 `cardGrid` — the context it works in, and where it does not.
- S3–S7 `numbered` — five sequential plays.
- S8 `templateCard` — the actual script or template.
- S9 `cardGrid` — how to automate or repeat it.
- S10 `divider` — CTA.

### 17. TOOLS / RESOURCE ROUNDUP
- S1 `title` — "N tools that save me X hours a week".
- S2 `cardGrid` — the criteria you judged them on.
- S3–S8 `cardGrid` or `iconGrid` — one tool per card: what it replaces, what it costs you.
- S9 `bigStat` — total time or money saved.
- S10 `divider` — CTA.

### 18. MICRO-INTERVIEW / EXPERT QUOTES
- S1 `title` — "I asked N X the same question".
- S2 `cardGrid` — the question and why it matters.
- S3–S8 `quote` — one answer per slide, attributed.
- S9 `cardGrid` — the pattern across the answers.
- S10 `divider` — CTA.

---

## 2. SLIDE 1 — 80% OF THE OUTCOME

Nothing after slide 1 is read if slide 1 does not stop the scroll. Rules:

- **State the payoff, not the topic.** "Your Edge Model Does Not Need INT8" beats "Edge Deployment and Quantization".
- **3–8 words.** It must be legible as a thumbnail in a scrolling feed.
- **Mark ONE phrase for highlight** with `*asterisks*` — a number, a name, or the surprising word. It renders inside a filled accent block on its own line. Never mark the whole title; never mark two phrases.
- **Promise a count only if you deliver it.** A deck titled "10 Rules" with 7 rules is the fastest way to lose the comments.

### Hook formulas that keep working

1. Numbered promise — "10 rules to X"
2. Accusation — "You are doing X wrong. Here is the proof."
3. Result-first — "How I went from X to Y in Z"
4. Cost — "I lost $X. Here is what it taught me."
5. Contrarian — "Unpopular opinion: X is dead"
6. Curation — "I read X so you don't have to"
7. Insider — "The N questions every X asks me"
8. Negation — "Your X does not need Y"
9. Time-anchored — "18 months ago I could not X. Today I Y."
10. Named framework — "The 4C framework that closed $2M"

### Slide 2 is the second cliff

Between a fifth and a third of readers leave between slide 1 and slide 2.
**Slide 2 delivers the proof the cover promised** — the number, the contrast,
the answer. Never spend it on background, a table of contents, or "let me
introduce myself".

---

## 3. BODY COPY — the confession rhythm

The single biggest quality difference between a deck that reads as a person's
and one that reads as an agency's. Write standalone paragraphs of 1–2 complete
sentences, in the voice of someone talking. NOT bullet fragments. NOT headings
with colons.

The four-beat structure that recurs across every winning deck:

1. **What I used to do** — "I used to treat breaks like a reward for finishing the work."
2. **Why it broke** — "But when the work never really ends, that usually means no break at all."
3. **What I do now** — "Now I step away every couple of hours. 10 minutes to walk. Nothing with a screen."
4. **The result** — "I come back with more focus and usually finish the next task faster."

Then the takeaway card lands the principle: "Working longer is not the same as
getting more done. Step away before your focus disappears."

A slide that opens on advice ("Take regular breaks to stay productive") is the
failure mode. Advice is what everyone writes; the confession is what only this
person can write.

### The takeaway line

Every content slide carries one. Max ~110 characters, rendered in its own tinted
card. It must NOT restate the title — the title names the rule, the takeaway
explains why the rule is true. It is what makes the deck skimmable for someone
swiping fast, and skimmability is what produces saves.

---

## 4. STRUCTURAL RULES

- **One idea per slide.** The discipline that turns dense material into an accessible deck. If a slide needs two sentences of setup before its point, it is two slides.
- **Never the same template twice in a row.** Alternation is what makes a deck read as designed. The one exception is the PILLAR deck: 3 named pillars, 3 points each, a divider carrying each pillar name — there the repetition IS the structure.
- **Fill the templates.** `cardGrid` wants 3–4 items, `numbered` 4–5, `timeline` 4–5, `twoColumn` 3–5 per column, `worksheet` 3 Q&A pairs. A slide carrying one sentence where the template expects four items is a wasted slide.
- **Go deep, not broad.** Name the tool, the failure mode, the trade-off, the number. "Async state wipes across raw HTTP endpoints" earns a slide; "deployment is hard" does not.
- **Slides should flow into each other** so the deck reads as one document rather than ten posters. End a slide on a thought the next one picks up.
- **A summary slide before the CTA** consolidates the learning and is what readers screenshot.
- **End on a CTA, always** — repost/follow, or a specific offer. Never "thanks for reading".

---

## 5. NUMBERS AND CHARTS

Where a slide is a breakdown of quantities, write the items as `Label — number`:

```
Multi-currency reconciliation — 41
Intercompany matching — 22
Variance write-ups — 18
Review and sign-off — 9
```

That renders as a real horizontal bar chart with the largest bar in the accent
colour. It is the strongest single slide in any deck. Use it once per deck, on
the split that carries the argument.

`bigStat` is the other numeric slide: ONE figure at huge scale plus a short
label. Use it for the number the whole deck rests on.

**Never invent a number.** A fabricated statistic is a liability the creator has
to defend in the comments and cannot. If there is no real figure, make the point
qualitatively.

---

## 6. DESIGN SYSTEM

The renderer offers four visual languages over the same slide data:

| Style | What it is | Use when |
|---|---|---|
| **Minimal** (`swipe`) | Paper ground, one accent, numbered chip, body card + takeaway card. No icons, no charts. | Default. Personal, senior, hiring-manager facing. |
| **Bold** (`attention`) | Minimal plus highlight chips, Q&A slides, bar charts and a follow-CTA outro. | When the deck has numbers, objections, or a strong CTA. |
| **Colour** (`editorial`) | Multi-colour, icons, progress rings, illustrated cards. | Marketing-flavoured, lighter topics. |
| **Brand** (`koyopo`) | Locked brand system: flat red on white, ten fixed templates. | Brand-consistent series. |

Rules that hold across all four:

- **Minimalist wins.** Colour marks position and emphasis; it does not decorate. One accent per deck.
- **Professional palettes** — low chroma except the single accent. Off-white grounds, never pure white.
- **Type floors are physical.** Below ~32pt-equivalent body on a 1080 canvas, mobile completion falls off a cliff. When copy will not fit at the floor, the answer is another slide, not smaller type.
- **Consistency across slides** is what makes a deck recognisable from the thumbnail alone. Same ground, same accent, same chip position, every slide.
- **Sign every slide.** Name bottom-right, swipe cue bottom-left.

---

## 7. WRITING FOR A JOB SEARCH AUDIENCE

The reader is a hiring manager or recruiter who scans. This changes what wins:

- **Lead with the mechanism, not the outcome.** "Automated the reconciliation in VBA" tells them what you can do; "improved efficiency" tells them nothing.
- **Every deck should prove a repeatable edge**, not a one-off win. Show the judgment, not just the execution — the choice you made and why, not only what happened.
- **Framework, case study and data-story types position best** for senior roles. Listicles build reach; frameworks build authority.
- **Numbers that survive scrutiny.** One real figure with its context beats five vague ones.
- **The CTA can be an invitation, not a pitch** — the type of problem you want to work on. Never "open to work".

---

## SOURCES

- Buffer — 11 LinkedIn carousel examples, formats and what made each work: https://buffer.com/resources/linkedin-carousel-examples/
- meet-lea — 15 carousel templates with slide-by-slide structure and 2026 benchmark data: https://meet-lea.com/en/blog/linkedin-carousel-examples
- Postpika — LinkedIn carousel type catalogue: https://www.postpika.com/blog/linkedin-carousel-complete-guide
- alpha.one — 5 ways for carousels to grab attention: https://www.alpha.one/blog/5-ways-for-linkedin-carousels-to-grab-attention-instantly
- Postory — carousels vs text posts, 3:1 outperformance: https://postory.io/blog/linkedin-carousels-guide
- Oktopost — carousel best practices and B2B benchmarks: https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/
- Reference decks: Will McTighe ("10 Rules to 10X Your Output"), Justin Welsh, Jasmin Alić, Sahil Bloom, Jay Clouse, Eddie Shleyner, Sam Browne, Alex Smith
