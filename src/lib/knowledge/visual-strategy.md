# VISUAL STRATEGY — which engine to use, and when

Three ways to produce a visual in this app. They are not interchangeable: one is
free and always works, one costs money per image, and one is unreliable by the
vendor's own behaviour. Pick deliberately.

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

## 2. TEXT-TO-IMAGE — for photographic backgrounds

`generateImage()` in `src/lib/gathos.ts`. Needs `GATHOS_IMAGE_API_KEY`.

- **Cost:** paid, per image.
- **Reliability:** production-solid. This is the engine the single-image post
  path already uses.
- **Produces:** a text-free editorial background. The app then overlays the copy
  itself via `composeCard()` — which is why the visuals never contain typos.

**Use for:** single-image posts where a photographic or textured backdrop adds
something a flat colour cannot — mood, atmosphere, a sense of place.

**Do not use for:** carousels. Paying per slide for a background that the vector
renderer would draw better, and free, is a straight loss.

---

## 3. IMAGE-TO-IMAGE / FACE — unreliable, treat as best-effort

`editImage()` in `src/lib/gathos.ts`. Needs `GATHOS_I2I_API_KEY`.

**This is the face-cloning path, and it is the weakest link in the stack.**

- Gathos's i2i route is flaky across their instances. The client is written to
  return `null` on failure rather than throw, precisely so a failure degrades to
  text-to-image instead of breaking the request.
- Face fidelity is materially below what a frontier image model produces. It will
  generate *a* face; it will not reliably preserve *your* face.

**So do not build a feature that depends on face cloning working.** Any flow that
needs the creator's actual likeness should either:

1. **Use a real photograph the creator uploads.** For a personal-brand post, a
   real photo of the person beats any generated likeness — it is authentic, it is
   free, and there is no uncanny-valley risk. This is almost always the right
   answer.
2. **Avoid the face entirely.** Text-oriented carousels, which are what perform
   on LinkedIn anyway, need no likeness at all.
3. **Escalate to a frontier image model** only if likeness is genuinely required
   and a real photo is impossible — and price it in, because it is the most
   expensive path here.

---

## DECISION RULE

Ask what the visual actually has to carry:

| The visual must carry | Use |
|---|---|
| An idea, a framework, a number, a list, a contrast | **Vector renderer** — free, exact, always works |
| Mood, atmosphere, a sense of place, behind one line of copy | **Text-to-image** — paid, reliable |
| The creator's real face | **A real uploaded photo.** Not i2i. |
| A face that does not have to be anyone specific | Text-to-image with a portrait prompt |

Default to the vector renderer. Reach past it only when a photograph is doing
work that typography cannot — which, for LinkedIn carousels, is rare.

---

## CURRENT CONFIGURATION

Image generation runs through `src/lib/image-engine.ts`, which picks an engine
automatically:

- **Gathos** (`GATHOS_IMAGE_API_KEY`, an `img_live_…` key) is the PRIMARY engine
  when set — server-side, exact pixel sizing, the engine the app was built for.
- **Gemini** (each user's own key from Settings) is the automatic FALLBACK when
  the Gathos key is absent.

So single-image posts and carousel backgrounds work as long as EITHER key is
present. `GATHOS_IMAGE_API_KEY` is currently set in `.env.local`, so Gathos is
active. Set `GATHOS_I2I_API_KEY` too if you want the best-effort face path.
Restart the dev server after changing `.env.local` so Next picks it up.
