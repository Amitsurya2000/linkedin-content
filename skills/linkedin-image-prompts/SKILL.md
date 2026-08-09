---
name: linkedin-image-prompts
description: Turn any topic into 10-20 professional, scroll-stopping AI image prompts for LinkedIn, across photographic and "written/annotated" styles (documentary + caption, hand-drawn diagram, sketchbook, blueprint, cinematic, 3D, product). Optionally generates the actual images via fal.ai. Trigger on /linkedin-image-prompts, "linkedin image prompts", "linkedin prompts about X", "image prompts for linkedin", "make linkedin prompts".
---

# LinkedIn Image Prompt Generator

## Core Intent
Take ANY topic the user gives (e.g. "AI agents", "retirement planning", "coffee brand")
and produce a batch of 10-20 professional, attention-grabbing AI image prompts ready to
post on LinkedIn — then, if the user wants, generate the actual images.

Two prompt families, always available:
- **Photographic / cinematic / design** — clean product, portraits, 3D, abstract brand art.
- **Written / annotated** — the text lives INSIDE the image: documentary + handwritten
  caption, hand-drawn labeled diagram, sketchbook/field notes, blueprint, whiteboard, chalkboard.

## Setup
| Item | Path |
|------|------|
| Generation backend | fal.ai — FLUX Pro v1.1 Ultra (photos) + Recraft V3 (text/handwriting) |
| Runner script | /Users/rv/GBM- APPS/linkedin-image-prompts/fal_generate.py |
| API key | FAL_KEY in /Users/rv/GBM- APPS/linkedin-image-prompts/.env (auto-loaded, never print it) |
| Output | /Users/rv/GBM- APPS/linkedin-image-prompts/output/{topic-slug}-{YYYYMMDD}/ |

## Interactive Flow
1. **Topic** — if the user didn't give one, ask: "What topic should these prompts be about?"
2. **How many** — default 12 (range 10-20).
3. **Family** — default: a MIX (about half photographic, half written/annotated).
   If the user asked specifically for "written / documentary / drawing / annotated", make
   the whole batch from the WRITTEN family. If they asked for "professional photos / clean",
   use the PHOTOGRAPHIC family.
4. **Generate images?** — ask "Want me to also generate the images (Y/N)?" Default: just
   prompts unless the user says yes.

## Output format for prompts (ALWAYS)
For each prompt, output in the chat:
- A short **hook line** (why it stops the scroll / what post it fits).
- A **copy-paste block** with the full prompt.
- Fill any placeholders with the user's actual topic — never leave raw `[BRACKETS]` unless
  the user explicitly wants a reusable template.
Number them 1..N. Keep it clean and skimmable (this is the product the user posts from).

## STYLE LIBRARY (draw from these; vary across the batch, do not repeat a style twice unless asked)

### Photographic family
1. Knolling flatlay — top-down grid of themed objects, editorial product photography, warm surface, soft studio light, 8k.
2. Double-exposure portrait — subject silhouette filled with a themed scene (skyline, nature, data), cinematic teal-and-amber grade.
3. Tilt-shift miniature diorama — tiny people/world acting out the concept, macro, playful pastels, shallow depth of field.
4. 3D isometric infographic — glossy blocks/steps/figures explaining the idea, corporate palette, soft gradient background.
5. Cinematic founder/professional portrait — tailored subject, glass office bokeh, Rembrandt light, 85mm, editorial.
6. Conceptual "data-as-landscape" art — themed metaphor landscape, volumetric light, deep blues + gold, cinematic 8k.
7. Vintage magazine ad — retro illustration of the topic, faded print colors, halftone texture, bold serif headline space.
8. Glassmorphism 3D icon — single frosted-glass icon of the topic on a soft gradient, translucent, premium tech render.
9. Before/after split-screen — chaotic monochrome half vs bright organized half, symbolic of transformation, photoreal.
10. Extreme macro symbol — tiny hero object (lightbulb, seed, spark) representing the idea, dramatic rim light, black background.
11. Low-poly isometric "tiny city" of the industry — clean blender-render look, pastel palette, playful and organized.
12. Cinematic silhouette at golden hour — aspirational figure, vast glowing sky, lens flare, warm grade.
13. Hyper-real commercial product shot — the topic's object with dramatic side light on dark slate, glossy, advertising quality.
14. Abstract brand gradient — flowing chrome/iridescent liquid-metal shapes, premium minimalist brand aesthetic (great as banner).

### Written / annotated family (text INSIDE the image)
W1. Documentary photo + handwritten caption — candid B&W 35mm shot of a themed moment, white-ink handwritten caption line below.
W2. Naturalist's annotated diagram — aged cream paper, ink + light watercolor, handwritten labels and curved arrows on each stage.
W3. Da Vinci sketchbook page — pencil drawing of the topic's object with handwritten notes, measurements, labeled arrows, sepia paper.
W4. Whiteboard explainer sketch — office whiteboard marker diagram of the concept, boxes/arrows, labels, a hand holding the marker.
W5. Architect's blueprint — blue blueprint paper, white line work, dimension lines, handwritten part annotations.
W6. Field/travel journal page — watercolor sketch + handwritten diary notes, dates, doodles, warm light, textured paper.
W7. "How it works" cutaway diagram — hand-drawn cutaway with handwritten labels and thin arrows to internal parts, manual style.
W8. Documentary photo + film subtitle bar — cinematic candid shot with a subtitle bar showing a short quote at the bottom.
W9. Illustrated recipe/step card — hand-illustrated result on top, handwritten step-by-step instructions with little icons.
W10. Storyboard panels — 4 hand-sketched panels telling the topic's story, handwritten scene notes under each panel, B&W.
W11. Scientific specimen plate — detailed hand-drawn illustration, elegant handwritten labels, numbered callouts, aged parchment.
W12. Chalkboard lesson — black chalkboard, white/colored chalk diagram of the concept, arrows and circled keywords, warm classroom light.

Every prompt should end with concrete quality cues (lighting, lens/medium, mood, "high detail / 8k / editorial").
Keep any in-image text SHORT (a few words) so the model renders it cleanly.

## Generating images (only if the user said yes)
1. Slug the topic (lowercase, hyphens) and set out_dir = output/{slug}-{YYYYMMDD}/.
2. Write a prompts JSON to that folder as `prompts.json`, one object per prompt:
   `{"name": "01-knolling", "prompt": "<full filled prompt>", "model": "flux", "size": "square"}`
   - Use `"model": "recraft"` for ALL written/annotated prompts (best text rendering).
   - Use `"model": "flux"` for photographic/cinematic/3D/abstract prompts.
   - `size`: "square" (default), "portrait" (portraits/journal pages), "landscape" (banners/wide scenes).
3. Run (background, 10-min timeout):
   `cd "/Users/rv/GBM- APPS/linkedin-image-prompts" && python3 fal_generate.py "<out_dir>/prompts.json" "<out_dir>"`
4. Report each saved file path on its own line so it uploads. Keep prompts.json.

## Rules
1. Always fill placeholders with the user's real topic before showing prompts.
2. Vary styles across the batch; don't repeat a style unless asked.
3. Default to prompts-only; generate images only when the user opts in.
4. Route written/annotated -> recraft, photographic -> flux. Never print the API key.
5. Keep in-image text short; always add lighting/medium/mood/quality cues.
6. When images are generated, output every final path on its own line at the end.
