import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Join a post's three stored fields into the text that gets pasted into LinkedIn.
 *
 * The model routinely writes a COMPLETE post into `body` — opening line and
 * hashtags included — while the schema keeps hook, body and hashtags as separate
 * columns. Everything downstream then concatenated all three, so the pasted post
 * carried its opening line twice and its hashtags twice.
 *
 * Measured across the 76 posts in the database when this was written: 39% had a
 * body starting with the hook, 87% had the hashtags already inside the body. It
 * is invisible inside the app because the preview renders the fields separately
 * — you only see it after pasting.
 *
 * The prompt now forbids it for new posts. This stays because it also repairs
 * every post generated before that, and because a model instruction is a
 * request rather than a guarantee.
 */
export function composePost(hook: string, body: string, hashtags: string[] = []): string {
  const h = (hook ?? "").trim();
  let b = (body ?? "").trim();

  // Case-insensitive: the model sometimes re-cases its own opening line.
  if (h && b.toLowerCase().startsWith(h.toLowerCase())) {
    b = b.slice(h.length).trimStart();
  }

  // Drop a trailing run of hashtag-only lines, plus any blank lines behind them.
  const lines = b.split("\n");
  const isTagLine = (l: string) => /^\s*(?:#[^\s#]+\s*)+$/.test(l);
  while (lines.length && (isTagLine(lines[lines.length - 1]) || !lines[lines.length - 1].trim())) {
    lines.pop();
  }
  b = lines.join("\n").trimEnd();

  const tags = (hashtags ?? [])
    .map((t) => `#${String(t).replace(/^#+/, "").trim()}`)
    .filter((t) => t.length > 1)
    .join(" ");

  return [h, b, tags].filter((part) => part.length > 0).join("\n\n");
}
