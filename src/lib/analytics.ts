/**
 * Local performance analysis.
 *
 * Everything here is arithmetic over hand-entered rows — no API, no model call.
 * The questions it answers are the ones that actually change what you post
 * next: which format earns engagement, which hook lands, which day works, and
 * whether the account is trending up.
 */

export interface MetricRow {
  id: string;
  label?: string | null;
  postType?: string | null;
  hookCategory?: string | null;
  impressions?: number | null;
  reactions?: number | null;
  comments?: number | null;
  reposts?: number | null;
  saves?: number | null;
  profileViews?: number | null;
  postedAt?: Date | number | null;
}

export interface Bucket {
  key: string;
  posts: number;
  impressions: number;
  engagements: number;
  /** Engagements per 100 impressions. */
  rate: number;
  avgImpressions: number;
}

export interface Insights {
  totals: {
    posts: number;
    impressions: number;
    engagements: number;
    rate: number;
    profileViews: number;
  };
  byType: Bucket[];
  byHook: Bucket[];
  byDay: Bucket[];
  best: MetricRow | null;
  worst: MetricRow | null;
  /** Plain-language observations, strongest first. */
  findings: string[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function engagementsOf(r: MetricRow): number {
  return (r.reactions ?? 0) + (r.comments ?? 0) + (r.reposts ?? 0) + (r.saves ?? 0);
}

function rateOf(engagements: number, impressions: number): number {
  return impressions > 0 ? (engagements / impressions) * 100 : 0;
}

function bucket(rows: MetricRow[], keyOf: (r: MetricRow) => string | null): Bucket[] {
  const map = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([key, rs]) => {
      const impressions = rs.reduce((a, r) => a + (r.impressions ?? 0), 0);
      const engagements = rs.reduce((a, r) => a + engagementsOf(r), 0);
      return {
        key,
        posts: rs.length,
        impressions,
        engagements,
        rate: rateOf(engagements, impressions),
        avgImpressions: Math.round(impressions / rs.length),
      };
    })
    .sort((a, b) => b.rate - a.rate);
}

/** Buckets with only one post behind them are noise, not signal. */
const MIN_POSTS = 2;

export function computeInsights(rows: MetricRow[]): Insights {
  const impressions = rows.reduce((a, r) => a + (r.impressions ?? 0), 0);
  const engagements = rows.reduce((a, r) => a + engagementsOf(r), 0);

  const byType = bucket(rows, (r) => r.postType ?? null);
  const byHook = bucket(rows, (r) => (r.hookCategory ? r.hookCategory.split(".")[0].trim() : null));
  const byDay = bucket(rows, (r) => {
    if (!r.postedAt) return null;
    const d = r.postedAt instanceof Date ? r.postedAt : new Date(r.postedAt);
    return isNaN(d.getTime()) ? null : DAYS[d.getDay()];
  });

  const ranked = [...rows].sort((a, b) => rateOf(engagementsOf(b), b.impressions ?? 0) - rateOf(engagementsOf(a), a.impressions ?? 0));

  const findings: string[] = [];

  if (rows.length < 5) {
    findings.push(`Only ${rows.length} post${rows.length === 1 ? "" : "s"} logged. Patterns below are indicative at best — log 10+ before changing strategy on them.`);
  }

  const types = byType.filter((b) => b.posts >= MIN_POSTS);
  if (types.length >= 2) {
    const [top, bottom] = [types[0], types[types.length - 1]];
    if (top.rate > bottom.rate * 1.3) {
      findings.push(`${top.key} posts engage at ${top.rate.toFixed(1)}% vs ${bottom.rate.toFixed(1)}% for ${bottom.key} — roughly ${(top.rate / Math.max(bottom.rate, 0.01)).toFixed(1)}× better. Post more ${top.key}.`);
    }
  }

  const hooks = byHook.filter((b) => b.posts >= MIN_POSTS);
  if (hooks.length >= 2) {
    findings.push(`Your strongest hook archetype is "${hooks[0].key}" at ${hooks[0].rate.toFixed(1)}% engagement across ${hooks[0].posts} posts. Weakest is "${hooks[hooks.length - 1].key}" at ${hooks[hooks.length - 1].rate.toFixed(1)}%.`);
  }

  const days = byDay.filter((b) => b.posts >= MIN_POSTS);
  if (days.length >= 2) {
    findings.push(`${days[0].key} is your best posting day (${days[0].rate.toFixed(1)}% engagement, ${days[0].avgImpressions.toLocaleString()} avg impressions).`);
  }

  // Comment rate is the metric LinkedIn's feed weights hardest, so it gets
  // called out separately from blended engagement.
  const totalComments = rows.reduce((a, r) => a + (r.comments ?? 0), 0);
  if (impressions > 0) {
    const cRate = (totalComments / impressions) * 100;
    findings.push(
      cRate < 0.15
        ? `Comment rate is ${cRate.toFixed(2)}% — low. Comments carry more feed weight than reactions; end posts on a specific question, not "thoughts?".`
        : `Comment rate is ${cRate.toFixed(2)}%, which is healthy. Keep ending on a specific question.`
    );
  }

  const totalSaves = rows.reduce((a, r) => a + (r.saves ?? 0), 0);
  if (totalSaves === 0 && rows.length >= 3) {
    findings.push(`No saves logged at all. Saves compound — checklists, cheat-sheets and frameworks are the formats that earn them.`);
  }

  if (ranked.length >= 4) {
    const half = Math.floor(ranked.length / 2);
    const recent = rows.slice(0, half);
    const older = rows.slice(half);
    const rRate = rateOf(recent.reduce((a, r) => a + engagementsOf(r), 0), recent.reduce((a, r) => a + (r.impressions ?? 0), 0));
    const oRate = rateOf(older.reduce((a, r) => a + engagementsOf(r), 0), older.reduce((a, r) => a + (r.impressions ?? 0), 0));
    if (oRate > 0) {
      const delta = ((rRate - oRate) / oRate) * 100;
      if (Math.abs(delta) > 15) {
        findings.push(
          delta > 0
            ? `Recent posts are engaging ${delta.toFixed(0)}% better than your earlier ones. Whatever changed, keep doing it.`
            : `Recent posts are engaging ${Math.abs(delta).toFixed(0)}% worse than your earlier ones. Look at what the older set did differently.`
        );
      }
    }
  }

  return {
    totals: {
      posts: rows.length,
      impressions,
      engagements,
      rate: rateOf(engagements, impressions),
      profileViews: rows.reduce((a, r) => a + (r.profileViews ?? 0), 0),
    },
    byType,
    byHook,
    byDay,
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    findings,
  };
}
