import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { KOYOPO, type KoyopoSlide, type CanvasName } from "./koyopo";

/**
 * KOYOPO deck → .pptx, with live text rather than flattened images.
 *
 * This is deliberately a separate path from the PNG renderer in koyopo.ts. The
 * PNGs are for posting to LinkedIn; this is for handing someone a deck they can
 * still edit. Every string stays a real text box, so the client can fix a typo
 * without regenerating anything.
 *
 * Poppins must be installed on whoever opens the file — PowerPoint references
 * fonts by name and silently substitutes when missing. The TTFs in assets/fonts
 * are there to hand over alongside the deck.
 */

/** Slide masters in inches. `wide` is the spec's native 13.33x7.5 canvas. */
const LAYOUTS: Record<CanvasName, { w: number; h: number; name: string }> = {
  wide: { w: 13.33, h: 7.5, name: "KOYOPO_WIDE" },
  tall: { w: 7.5, h: 9.375, name: "KOYOPO_TALL" }, // 4:5, matching the PNG ratio
};

const FONT = "Poppins";
const RED_TEMPLATES = new Set(["title", "divider", "quote"]);

/** Split "Concept — expansion." the same way the PNG renderer does. */
function splitItem(item: string): { prefix: string | null; rest: string } {
  const i = item.indexOf(" — ");
  if (i === -1 || i > 60) return { prefix: null, rest: item };
  return { prefix: item.slice(0, i), rest: item.slice(i + 3) };
}

export interface PptxOptions {
  canvas?: CanvasName;
  deckTitle?: string;
}

/**
 * Rendered slides → .pptx, one full-bleed image per slide.
 *
 * `buildPptx` below rebuilds the deck out of live text boxes, which only the
 * KOYOPO layout has templates for. Every other style — Minimal, Bold, Colour,
 * Visual, Campaign and the eight spec-driven ones — is drawn by an SVG renderer
 * with no pptxgenjs equivalent, so a text-based export could not represent them
 * and quietly substituted KOYOPO instead. Placing the rendered frame gives a
 * .pptx that matches what is on screen for all fifteen.
 *
 * The trade is that the text is no longer editable in PowerPoint. That is the
 * right trade here: the file exists to be uploaded to LinkedIn as a document
 * post, where it is flattened to images on arrival anyway, and a deck that
 * matches the preview beats one that can be edited but is the wrong design.
 *
 * The slide size comes from the frame itself rather than a fixed layout, so a
 * renderer that emits an unexpected aspect ratio is reproduced exactly instead
 * of being stretched to fit.
 */
/**
 * Rendered slides → PDF, one full-bleed page per slide.
 *
 * This is the format LinkedIn actually wants. A document post accepts PDF,
 * PPTX or DOCX, but PDF is the one that uploads without conversion and renders
 * identically for every viewer — PowerPoint files get re-flowed on the way in,
 * which is exactly the risk a carefully positioned deck cannot take.
 *
 * Page size is the frame's own pixel size mapped 1px → 1pt, so the aspect ratio
 * is preserved by construction and nothing is scaled or cropped.
 */
export async function buildPdfFromImages(frames: Buffer[]): Promise<Buffer> {
  if (!frames.length) throw new Error("No slides to export.");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const frame of frames) {
    const img = await pdf.embedPng(frame);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return Buffer.from(await pdf.save());
}

export async function buildPptxFromImages(
  frames: Buffer[],
  opts: PptxOptions = {}
): Promise<Buffer> {
  if (!frames.length) throw new Error("No slides to export.");

  const meta = await sharp(frames[0]).metadata();
  const pxW = meta.width ?? 1080;
  const pxH = meta.height ?? 1350;
  // 13.33in on the long edge is PowerPoint's own widescreen width, which keeps
  // the deck at a familiar scale whichever way round the frame is.
  const inW = pxW >= pxH ? 13.333 : 13.333 * (pxW / pxH);
  const inH = inW * (pxH / pxW);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DECK", width: inW, height: inH });
  pptx.layout = "DECK";
  if (opts.deckTitle) pptx.title = opts.deckTitle;

  for (const frame of frames) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: `image/png;base64,${frame.toString("base64")}`,
      x: 0,
      y: 0,
      w: inW,
      h: inH,
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

export async function buildPptx(slides: KoyopoSlide[], opts: PptxOptions = {}): Promise<Buffer> {
  const canvas: CanvasName = opts.canvas ?? "wide";
  const L = LAYOUTS[canvas];

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: L.name, width: L.w, height: L.h });
  pptx.layout = L.name;
  if (opts.deckTitle) pptx.title = opts.deckTitle;

  const M = L.w * 0.075; // side margin, matching the PNG renderer's 7.5%
  const contentW = L.w - M * 2;

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    const onRed = RED_TEMPLATES.has(s.template);
    slide.background = { color: onRed ? KOYOPO.red : KOYOPO.white };
    const fg = onRed ? KOYOPO.white : KOYOPO.ink;

    // ── Corner slots ──
    if (s.sectionTag) {
      slide.addText(s.sectionTag.toUpperCase().slice(0, 30), {
        x: M, y: L.h * 0.04, w: contentW * 0.6, h: 0.3,
        fontFace: FONT, fontSize: 11, bold: true, charSpacing: 1.5,
        color: onRed ? KOYOPO.white : KOYOPO.red,
      });
    }
    slide.addText(`${idx + 1} / ${slides.length}`, {
      x: L.w - M - 1.2, y: L.h * 0.04, w: 1.2, h: 0.3, align: "right",
      fontFace: FONT, fontSize: 9, color: onRed ? KOYOPO.white : KOYOPO.muted,
    });
    if (s.moduleTag) {
      slide.addText(s.moduleTag, {
        x: M, y: L.h - 0.5, w: contentW * 0.5, h: 0.3,
        fontFace: FONT, fontSize: 9, color: onRed ? KOYOPO.white : KOYOPO.muted,
      });
    }
    if (opts.deckTitle) {
      slide.addText(opts.deckTitle, {
        x: L.w - M - 3, y: L.h - 0.5, w: 3, h: 0.3, align: "right",
        fontFace: FONT, fontSize: 9, color: onRed ? KOYOPO.white : KOYOPO.muted,
      });
    }

    switch (s.template) {
      case "title":
        slide.addText(s.title ?? "", {
          x: M, y: L.h * 0.28, w: contentW, h: L.h * 0.4,
          fontFace: FONT, fontSize: canvas === "wide" ? 72 : 54, bold: true, color: fg, valign: "middle",
        });
        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: M, y: L.h * 0.74, w: contentW, h: 0.5,
            fontFace: FONT, fontSize: 16, italic: true, color: fg,
          });
        }
        break;

      case "divider":
        slide.addText(s.title ?? "", {
          x: M, y: L.h * 0.35, w: contentW, h: L.h * 0.3,
          fontFace: FONT, fontSize: canvas === "wide" ? 54 : 40, bold: true, color: fg, valign: "middle",
        });
        break;

      case "quote":
        slide.addText(s.body ?? s.title ?? "", {
          x: M, y: L.h * 0.28, w: contentW, h: L.h * 0.4,
          fontFace: FONT, fontSize: 30, bold: true, color: fg, valign: "middle",
        });
        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: M, y: L.h * 0.72, w: contentW, h: 0.4,
            fontFace: FONT, fontSize: 15, italic: true, color: fg,
          });
        }
        break;

      default: {
        // Shared heading for every white template.
        slide.addText(s.title ?? "", {
          x: M, y: L.h * 0.13, w: contentW, h: L.h * 0.14,
          fontFace: FONT, fontSize: 26, bold: true, color: KOYOPO.ink,
        });
        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: M, y: L.h * 0.27, w: contentW, h: 0.35,
            fontFace: FONT, fontSize: 14, italic: true, color: KOYOPO.muted,
          });
        }
        addWhiteBody(slide, s, { L, M, contentW, top: L.h * 0.34 });
      }
    }
  });

  // `nodebuffer` keeps this server-side; the browser path would need a blob.
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

function addWhiteBody(
  slide: Slide,
  s: KoyopoSlide,
  ctx: { L: { w: number; h: number }; M: number; contentW: number; top: number }
) {
  const { L, M, contentW, top } = ctx;
  const availH = L.h * 0.88 - top;

  switch (s.template) {
    case "cardGrid": {
      const items = (s.items ?? []).slice(0, 4);
      if (!items.length) break;
      const cols = items.length >= 3 ? 2 : 1;
      const rows = Math.ceil(items.length / cols);
      const gap = 0.18;
      const cw = (contentW - gap * (cols - 1)) / cols;
      const ch = (availH - gap * (rows - 1)) / rows;
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const x = M + (i % cols) * (cw + gap);
        const y = top + Math.floor(i / cols) * (ch + gap);
        slide.addShape("roundRect", {
          x, y, w: cw, h: ch,
          fill: { color: KOYOPO.cardFill }, line: { color: KOYOPO.cardBorder, width: 0.5 }, rectRadius: 0.06,
        });
        slide.addText(
          prefix
            ? [
                { text: prefix + "\n", options: { bold: true, color: KOYOPO.red } },
                { text: rest, options: { color: KOYOPO.ink } },
              ]
            : [{ text: rest, options: { color: KOYOPO.ink } }],
          { x: x + 0.18, y, w: cw - 0.36, h: ch, fontFace: FONT, fontSize: 13, valign: "middle" }
        );
      });
      break;
    }

    case "numbered":
    case "timeline": {
      const items = (s.items ?? []).slice(0, 5);
      const step = availH / Math.max(1, items.length);
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const y = top + i * step;
        slide.addText(s.template === "numbered" ? String(i + 1).padStart(2, "0") : "•", {
          x: M, y, w: 0.6, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: KOYOPO.red,
        });
        slide.addText(
          prefix
            ? [
                { text: prefix + "\n", options: { bold: true, color: KOYOPO.red } },
                { text: rest, options: { color: KOYOPO.ink } },
              ]
            : [{ text: rest, options: { color: KOYOPO.ink } }],
          { x: M + 0.7, y, w: contentW - 0.7, h: step * 0.9, fontFace: FONT, fontSize: 13 }
        );
      });
      break;
    }

    case "worksheet": {
      const items = (s.items ?? []).slice(0, 5);
      const step = availH / Math.max(1, items.length);
      items.forEach((it, i) => {
        const y = top + i * step;
        slide.addText(it, {
          x: M, y, w: contentW, h: step * 0.5, fontFace: FONT, fontSize: 13, color: KOYOPO.ink,
        });
        slide.addShape("line", {
          x: M, y: y + step * 0.62, w: contentW, h: 0, line: { color: KOYOPO.cardBorder, width: 0.5 },
        });
      });
      break;
    }

    case "twoColumn": {
      const cols = (s.columns ?? []).slice(0, 2);
      const gap = 0.25;
      const cw = (contentW - gap) / 2;
      cols.forEach((col, ci) => {
        const x = M + ci * (cw + gap);
        slide.addText(col.heading.toUpperCase().slice(0, 30), {
          x, y: top, w: cw, h: 0.35,
          fontFace: FONT, fontSize: 12, bold: true, charSpacing: 1.2, color: KOYOPO.red,
        });
        slide.addText(col.items.slice(0, 5).map((t) => ({ text: t, options: { bullet: true } })), {
          x, y: top + 0.45, w: cw, h: availH - 0.45, fontFace: FONT, fontSize: 13, color: KOYOPO.ink,
        });
      });
      break;
    }

    case "bigStat": {
      slide.addText(s.stat ?? "", {
        x: M, y: top + availH * 0.15, w: contentW, h: availH * 0.4, align: "center",
        fontFace: FONT, fontSize: 66, bold: true, color: KOYOPO.red,
      });
      if (s.statLabel) {
        slide.addText(s.statLabel.toUpperCase().slice(0, 30), {
          x: M, y: top + availH * 0.58, w: contentW, h: 0.35, align: "center",
          fontFace: FONT, fontSize: 12, bold: true, charSpacing: 1.4, color: KOYOPO.muted,
        });
      }
      if (s.body) {
        slide.addText(s.body, {
          x: M, y: top + availH * 0.72, w: contentW, h: 0.6, align: "center",
          fontFace: FONT, fontSize: 13, color: KOYOPO.ink,
        });
      }
      break;
    }

    case "templateCard": {
      slide.addShape("roundRect", {
        x: M, y: top, w: contentW, h: availH,
        fill: { color: KOYOPO.cardFill }, line: { color: KOYOPO.cardBorder, width: 0.5 }, rectRadius: 0.06,
      });
      // **bold** is legal inside template cards only — render it as real runs.
      const runs = (s.body ?? "").split("\n").map((raw) => {
        const b = /^\*\*(.+)\*\*$/.exec(raw.trim());
        return { text: (b ? b[1] : raw) + "\n", options: { bold: !!b, color: KOYOPO.ink } };
      });
      slide.addText(runs, {
        x: M + 0.3, y: top + 0.25, w: contentW - 0.6, h: availH - 0.5, fontFace: FONT, fontSize: 13,
      });
      break;
    }
  }
}
