import fs from "fs";
import os from "os";
import path from "path";

/**
 * Serverless font bootstrap (NeverCache's issue: SVG text blank on Vercel).
 *
 * Vercel / AWS Lambda run with read-only filesystems and NO installed fonts.
 * sharp rasterises SVG through librsvg, which on Linux resolves <text> via
 * fontconfig — with no fonts registered it silently draws nothing, producing
 * carousels that are bare backgrounds.
 *
 * This runs once at server startup, before any route handler calls sharp:
 *   1. Locates the bundled Poppins TTFs (traced into the function by
 *      `outputFileTracingIncludes` in next.config.ts).
 *   2. Writes a minimal fonts.conf that lists that directory, with a writable
 *      cache dir under os.tmpdir() (the Lambda "disk").
 *   3. Points fontconfig at it via FONTCONFIG_FILE, overriding any stale
 *      FONTCONFIG_PATH that may be set in the dashboard.
 *
 * The base64 @font-face blocks in src/lib/font-data.ts (embedded into every
 * SVG) are the primary mechanism and need no host fonts; this is the fallback
 * that covers librsvg builds which ignore SVG @font-face.
 */
function configureFontConfig(): void {
  try {
    const fontsDir = path.join(process.cwd(), "assets", "fonts");
    if (!fs.existsSync(fontsDir)) return;

    const cacheDir = path.join(os.tmpdir(), "fontconfig-cache");
    fs.mkdirSync(cacheDir, { recursive: true });

    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`;
    const confPath = path.join(os.tmpdir(), "fonts.conf");
    fs.writeFileSync(confPath, conf);
    // FONTCONFIG_FILE takes precedence over any dashboard-level FONTCONFIG_PATH.
    process.env.FONTCONFIG_FILE = confPath;
    process.env.XDG_CACHE_HOME = os.tmpdir();
  } catch (err) {
    console.warn("fontconfig bootstrap failed (text may fall back):", err);
  }
}

export function register(): void {
  configureFontConfig();
}