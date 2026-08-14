# KOYOPO SLIDE WRITING RULES (1Cr+ CAREER OS)

These are WRITING rules, not design rules. The renderer owns colour, font and
layout. Your job is to produce copy that physically fits the KOYOPO templates.
Text written past these limits gets shrunk or clipped on the slide, so treat
every character count as hard.

---

## 1. PICK A TEMPLATE FOR EVERY SLIDE

Set `slideTemplate` on each slide to exactly one of these ten names.

**Red background — use sparingly, for punctuation:**
- `title` — the cover. One short deck title. No body.
- `divider` — a section break. Two or three words only.
- `quote` — one quotable line. The single strongest sentence in the deck.

**White background — the working slides:**
- `cardGrid` — 3 or 4 short items, each a concept plus a one-line expansion.
- `numbered` — 3 to 5 sequential steps. Use when order matters.
- `worksheet` — prompts the reader answers themselves.
- `twoColumn` — a contrast. Old way vs new way, wrong vs right.
- `bigStat` — one number that carries the whole slide, plus a short label.
- `templateCard` — a fill-in-the-blank script or snippet the reader can copy.
- `timeline` — stages over time.

Do not use `title`, `divider` or `quote` back to back. Red slides are punctuation
between white working slides, never the substance.

---

## 2. HARD CHARACTER LIMITS

| Field | Limit | Why |
|---|---|---|
| `title` on a `title` slide | 45 characters | renders at 110pt |
| `title` on a `divider` slide | 25 characters | renders at 78pt |
| `body` on a `quote` slide | 120 characters | renders at 42pt |
| `title` on any white slide | 55 characters | renders at 36pt |
| One card / numbered item | 110 characters | must fit the card |
| Section tag | 30 characters, UPPERCASE | tracked-out label |
| `bigStat` number | 8 characters | e.g. `₹1Cr+`, `28%`, `3x` |
| `bigStat` label | 30 characters, UPPERCASE | sits under the number |
| Subhead / italic line | 90 characters | 15–16pt |

Count characters, not words. If a line is over, cut it — never let it run long.

---

## 3. THE ITEM FORMAT (cardGrid and numbered)

Every card and every numbered item is written as:

`Concept Name — one-sentence expansion.`

Three rules:
1. The separator is a spaced em dash: ` — `. Not a hyphen, not a colon.
2. The em dash must appear **within the first 60 characters**. That means the
   concept name is short — two to four words. The renderer bolds everything
   before the dash in red, so a long prefix swallows the slide.
3. The whole item stays under **110 characters**.

Good: `Visibility Audit — list every project your skip-level never heard about.`
Bad: `The visibility audit that most senior professionals skip entirely — and why it quietly caps your compensation for years.` (dash lands past 60, item over 110)

---

## 4. SECTION TAGS AND LABELS

Every white slide carries a short section tag: uppercase, 30 characters max, no
punctuation. It names the part of the deck, not the slide.

Examples: `POSITIONING`, `THE 40L TRAP`, `WHAT TO SAY INSTEAD`

---

## 5. INLINE BOLD

`**bold**` renders only inside `templateCard` slides. Anywhere else it prints as
literal asterisks and looks broken. Do not use bold on cards, numbered items,
titles or quotes.

---

## 6. DECK SHAPE

Open with `title`. Close with a call to action. In between, alternate white
working slides with the occasional red `divider` or `quote` for rhythm.

Each slide carries ONE idea. If a slide needs two, it is two slides.

Every sentence must be complete and self-contained. The text is printed verbatim
onto an image — a sentence that trails off cannot be fixed later.

---

## 7. NUMBERS MUST BE REAL

Never invent a statistic, percentage, currency figure, study, or dollar amount.

Use a number only if it comes from the creator's own profile or the brief you
were given. If you have no real number, write the point qualitatively instead.

A fabricated "28% lift" or "$1.4B market" is worse than no number at all — the
creator has to defend it in the comments, and cannot.
