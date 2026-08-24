/**
 * What this user has already been given, so the next render can avoid it.
 *
 * Both generators force variation in code rather than asking the model for it,
 * and that only works if they can see what came before. These two lookups are
 * the memory: the carousel builder excludes drawn topics, angles, hooks and
 * themes, and the content agent is shown the angles and hooks already used.
 *
 * Shared between `/api/generate` (first write) and `/api/posts/[id]/regenerate`
 * (every re-render after that) so both paths avoid the same history.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedPosts, postBatches } from "@/lib/db/schema";
import { HISTORY_LIMIT, type RenderChoice } from "@/lib/carousel-prompt";

/** The shape the carousel builder writes onto every slide's `design`. */
interface StoredDesign {
  angle?: string;
  hookFormula?: string;
  visualTheme?: string;
  topic?: string;
}

/**
 * The topic, angle, hook and theme this user's recent decks used.
 *
 * Read out of the slides' own `design` object, which is where the mapper writes
 * them — unlike `whyThisWorks` it is not a field the user can edit out from
 * under the lookup.
 *
 * Scoped to the user rather than to one topic string: the point is that two
 * consecutive renders look different, and a re-render keeps the same topic by
 * definition, so scoping to it would return the deck we are trying to avoid.
 */
export async function recentChoices(userId: string): Promise<RenderChoice[]> {
  try {
    const rows = await db
      .select({ headline: generatedPosts.hook, slides: generatedPosts.carouselSlides })
      .from(generatedPosts)
      .where(and(eq(generatedPosts.userId, userId), eq(generatedPosts.postType, "carousel")))
      .orderBy(desc(generatedPosts.createdAt))
      .limit(HISTORY_LIMIT);

    const out: RenderChoice[] = [];
    for (const r of rows) {
      if (!r.slides) continue;
      try {
        const parsed = JSON.parse(r.slides) as { design?: StoredDesign }[];
        const d = parsed[0]?.design;
        // Decks written before the builder have no choices to avoid.
        if (!d?.angle || !d.hookFormula || !d.visualTheme) continue;
        out.push({
          angle: d.angle,
          hook: d.hookFormula,
          theme: d.visualTheme,
          topic: d.topic,
          headline: r.headline || undefined,
        });
      } catch {
        continue;
      }
    }
    return out;
  } catch {
    // A history lookup that fails must not cost the user their generation — the
    // builder handles an empty history perfectly well.
    return [];
  }
}

/**
 * The angles and hooks this user's recent text and article posts used.
 *
 * `whyThisWorks` is where the content agent's `selected_resume_angle` lands, so
 * it doubles as the record of which angle each post took.
 */
export async function recentAngles(
  userId: string,
  topic?: string
): Promise<{ angle: string; hook: string }[]> {
  try {
    const where = topic
      ? and(eq(generatedPosts.userId, userId), eq(postBatches.topic, topic))
      : eq(generatedPosts.userId, userId);
    const rows = await db
      .select({ hook: generatedPosts.hook, angle: generatedPosts.whyThisWorks })
      .from(generatedPosts)
      .innerJoin(postBatches, eq(generatedPosts.batchId, postBatches.id))
      .where(where)
      .orderBy(desc(generatedPosts.createdAt))
      .limit(HISTORY_LIMIT);
    return rows
      .filter((r) => r.hook)
      .map((r) => ({ angle: r.angle || "(unrecorded)", hook: r.hook }));
  } catch {
    return [];
  }
}
