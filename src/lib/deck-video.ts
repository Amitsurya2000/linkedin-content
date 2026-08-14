import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Deck → video.
 *
 * LinkedIn treats native video as its own format with its own reach, and a
 * carousel already contains everything a slide video needs. This encodes the
 * rendered deck PNGs into an MP4 with a crossfade between slides, using the
 * ffmpeg already on the machine — no service, no key, no cost.
 *
 * Falls back to an animated WebP when ffmpeg is missing, so the feature degrades
 * to something usable rather than erroring.
 */

export interface VideoOptions {
  /** Seconds each slide is held. LinkedIn slide videos read best at 2.5-3.5s. */
  secondsPerSlide?: number;
  /** Crossfade duration between slides. */
  fadeSeconds?: number;
  fps?: number;
}

export async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-version"]);
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += String(d); });
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/**
 * Encode PNG buffers into an MP4.
 *
 * Frames are written to a temp dir because ffmpeg's concat/xfade filters need
 * real inputs, and piping many images through one stdin stream cannot express
 * per-input durations.
 */
export async function renderDeckVideo(frames: Buffer[], opts: VideoOptions = {}): Promise<Buffer> {
  if (!frames.length) throw new Error("No slides to encode");

  const hold = opts.secondsPerSlide ?? 3;
  const fade = Math.min(opts.fadeSeconds ?? 0.5, hold / 2);
  const fps = opts.fps ?? 30;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "deck-video-"));
  try {
    for (let i = 0; i < frames.length; i++) {
      await fs.writeFile(path.join(dir, `f${String(i).padStart(3, "0")}.png`), frames[i]);
    }
    const out = path.join(dir, "deck.mp4");

    // Each still becomes a clip, then clips are crossfaded pairwise. offset for
    // clip n is the sum of previous holds minus the fades already consumed.
    const inputs: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      inputs.push("-loop", "1", "-t", String(hold), "-i", path.join(dir, `f${String(i).padStart(3, "0")}.png`));
    }

    const filter: string[] = [];
    // Even dimensions are required by yuv420p; the deck is 1080x1350 already,
    // but a wide canvas or an odd resize would otherwise fail the encode.
    for (let i = 0; i < frames.length; i++) {
      filter.push(`[${i}:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=${fps},format=yuva420p,setsar=1[v${i}]`);
    }

    let last = "v0";
    if (frames.length > 1) {
      for (let i = 1; i < frames.length; i++) {
        const offset = (hold - fade) * i;
        const label = i === frames.length - 1 ? "vout" : `x${i}`;
        filter.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${label}]`);
        last = label;
      }
    } else {
      filter.push(`[v0]null[vout]`);
      last = "vout";
    }

    const args = [
      "-y",
      ...inputs,
      "-filter_complex", filter.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "20",
      "-movflags", "+faststart",
      out,
    ];

    const { code, stderr } = await run("ffmpeg", args);
    if (code !== 0) throw new Error(`ffmpeg failed: ${stderr.slice(-600)}`);
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Contact sheet fallback: every slide stacked into one tall PNG.
 *
 * Deliberately NOT an animated WebP. sharp can only emit an animation when the
 * page height travels with the pixels, which its typed API does not expose for
 * a strip assembled at runtime — and a fallback that silently produces a single
 * frozen frame is worse than no fallback. This at least gives something usable
 * on a machine with no ffmpeg, and the route says plainly that video is off.
 */
export async function renderDeckStrip(frames: Buffer[]): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(frames[0]).metadata();
  const width = meta.width ?? 1080;
  const height = meta.height ?? 1350;

  return sharp({
    create: { width, height: height * frames.length, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(frames.map((input, i) => ({ input, left: 0, top: i * height })))
    .png()
    .toBuffer();
}
