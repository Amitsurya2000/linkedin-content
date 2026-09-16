# VISUAL STRATEGY — which engine to use, and when

Two ways to produce a visual in this app. They are not interchangeable: one is
free and always works, one costs Gemini quota per image. Pick deliberately.

---

## 1. VECTOR RENDERER — the default

`src/lib/deck-render.ts` (colour/editorial) and `src/lib/koyopo.ts` (flat brand).

Draws typography, colour blocks, icons, charts and badges directly as SVG, then
rasterises with `sharp`.

- **Cost:** nothing. No API, no key, no per-image charge.
- **Reliability:** deterministic. The same input always produces the same output.
- **Speed:** milliseconds per slide.
- **Text:** pixel-perfect, because the app draws it rather than asking a model to.
- **Cannot do:** photographs, faces, real-world scenes, textures.

**Use for:** every carousel, every text-oriented deck, quote cards, stat cards,
frameworks, checklists, comparison slides. This covers the overwhelming majority
of high-performing LinkedIn content, which is text-oriented by nature.

---

## 2. PHOTO SEARCH + GEMINI EDIT — for photographic subjects

`generateBackground()` in `src/lib/image-engine.ts`, via `src/lib/tavily.ts`
(Pexels / Tavily search) and `editImage()` in `src/lib/gemini-image.ts`.

When a slide's `designDirection` names a real scene, the engine searches for a
real, freely-licensed photo of it (a query built from the slide's own concept
name plus the deck topic), then hands that photo to Gemini's image editor with
the slide's art brief as the alteration instruction — so the output still
carries the picture's real detail while matching the deck's palette and mood.
A generated stopwatch draws invented digits on its face; a searched one does
not, and Gemini only has to restyle it, not invent it from nothing.

- **Cost:** the photo search is free (Pexels/Tavily, optional keys); the Gemini
  edit call costs the same quota as a plain generation.
- **Reliability:** the search step returns `null` rather than throwing on a dead
  URL or an empty result, so a bad query costs one fall-through, not the image.
- **Produces:** a text-free editorial visual. The app then overlays the copy
  itself via `composeCard()` / the illustrated-deck layout, which is why the
  visuals never contain typos.

**Use for:** single-image posts and illustrated-carousel slides (the "visual"
style and the spec-driven lab styles) where a photographic or textured backdrop
adds something a flat colour cannot — mood, atmosphere, a sense of place.

**Falls back to plain Gemini text-to-image** when no photo turns up for the
query, or when neither `PEXELS_API_KEY` nor `TAVILY_API_KEY` is configured —
never a dead button, just a fully synthesised subject instead of a real one.

**Do not use for:** the flat-colour carousel styles (koyopo, colour/brand). Those
overlay multi-line text directly on the background image, and a busy photo
undermines the legibility a clean, even background gives for free.

---

## DECISION RULE

Ask what the visual actually has to carry:

| The visual must carry | Use |
|---|---|
| An idea, a framework, a number, a list, a contrast | **Vector renderer** — free, exact, always works |
| Mood, atmosphere, a sense of place, behind one line of copy | **Photo search + Gemini edit** |
| The creator's real face | **A real uploaded photo**, not a searched or generated one |
| A face that does not have to be anyone specific | Gemini text-to-image with a portrait prompt |

Default to the vector renderer. Reach past it only when a photograph is doing
work that typography cannot — which, for LinkedIn carousels, is rare.

---

## CURRENT CONFIGURATION

Every image call runs on the user's own Gemini key (per-user, added in Settings
— the only key required). `PEXELS_API_KEY` / `TAVILY_API_KEY` in `.env.local`
are optional and additive: set either to turn real-photo search on, leave both
empty and the app still runs on Gemini text-to-image alone.
