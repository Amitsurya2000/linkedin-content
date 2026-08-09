import { GoogleGenAI } from "@google/genai";

/**
 * Resume → Creator Profile analyzer.
 *
 * Gemini 2.5 reads PDFs natively (inline document part), so we can pass the raw
 * resume bytes directly — no separate PDF parser needed. Falls back to plain
 * text when the client pastes their resume instead of uploading a file.
 */

export interface CreatorProfileData {
  fullName: string;
  headline: string; // punchy LinkedIn-style positioning headline
  industry: string;
  targetAudience: string;
  summary: string; // 2–3 sentence "about them"
  expertise: string[]; // core skills / domains
  achievements: { text: string; metric?: string }[]; // quantified wins
  roles: { title: string; company: string; period?: string; highlights: string[] }[];
  signatureStories: string[]; // real experiences worth posting about
  voiceTone: string; // how their content should sound
  positioning: string; // their category-of-one angle
  contentPillars: { name: string; description: string }[]; // 4–5 pillars
  postIdeas: string[]; // 8–10 concrete post ideas grounded in the resume
  // From the one-pager (goals / what they want to work on / who they want to become).
  goals?: string; // one-line summary of what they want from LinkedIn
  objectives?: string[]; // specific outcomes they're after
  contentStrategy?: string; // the sharp strategic angle tying resume + goals together
}

const ANALYSIS_PROMPT = `You are an elite LinkedIn ghostwriter and personal-brand strategist. You are given a person's CV / resume, and OPTIONALLY a one-pager describing their goals — what they want to work on, who they want to reach, and what they're trying to become. Analyze BOTH deeply and extract a structured "Creator Profile" that becomes the BASE context for ALL of their LinkedIn content (posts, carousels, articles, image concepts).

Read EVERYTHING in both documents: experience, roles, achievements, skills, education, projects, personal/about sections, AND their stated goals and intent. Think like a strategist: where they've BEEN (resume) + where they WANT to go (one-pager) = their sharpest positioning. Go deep — surface non-obvious angles, tensions, and the stories only THEY can tell. If a one-pager is present, weight their goals heavily: the content should move them TOWARD what they said they want.

Return ONLY a valid JSON object (no markdown, no code fences) with exactly this structure:

{
  "fullName": "their name (or 'there' if not found)",
  "headline": "a punchy LinkedIn-style positioning headline: [Who they are] | [Problem they solve] | [Proof/result]",
  "industry": "their primary industry/niche",
  "targetAudience": "who they should be speaking to on LinkedIn",
  "summary": "2-3 sentence sharp summary of who they are and their edge",
  "expertise": ["6-10 specific skills/domains they can credibly speak on"],
  "achievements": [{"text": "a real, specific accomplishment from the resume", "metric": "the number/%/$ if present, else empty"}],
  "roles": [{"title": "role", "company": "company", "period": "dates if present", "highlights": ["1-3 notable things from that role"]}],
  "signatureStories": ["5-8 REAL experiences, pivots, lessons, or moments from their career that would make compelling personal LinkedIn posts"],
  "voiceTone": "one line on the tone their content should carry given their seniority and field",
  "positioning": "their category-of-one angle — the specific POV that makes them impossible to ignore in their space",
  "contentPillars": [{"name": "pillar", "description": "what they post about under it"}],
  "postIdeas": ["8-10 concrete, specific LinkedIn post ideas grounded in THIS person's actual experience AND their goals — not generic advice"],
  "goals": "one sharp line: what they want LinkedIn to do for them (from the one-pager; empty if none)",
  "objectives": ["3-5 specific outcomes they're after (from the one-pager; empty array if none)"],
  "contentStrategy": "2-3 sentences: the strategic through-line that connects their proven experience to where they want to go — the spine of their whole content plan"
}

Rules:
- Be specific and grounded in the actual documents. Never invent fake numbers.
- If a document is thin, infer sensibly but stay realistic.
- achievements: prefer ones with real metrics.
- When a one-pager is present, make postIdeas and contentPillars serve their stated goals.
- Everything must be usable verbatim as generation context.`;

interface AnalyzeParams {
  apiKey: string;
  pdfBase64?: string;
  mimeType?: string;
  text?: string;
  onePagerPdfBase64?: string;
  onePagerMimeType?: string;
  onePagerText?: string;
}

export async function analyzeResume(params: AnalyzeParams): Promise<CreatorProfileData> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const parts: Array<Record<string, unknown>> = [];
  if (params.pdfBase64) {
    parts.push({ inlineData: { mimeType: params.mimeType || "application/pdf", data: params.pdfBase64 } });
    parts.push({ text: "The document above is the RESUME / CV." });
  } else if (params.text && params.text.trim().length > 0) {
    parts.push({ text: `RESUME / CV:\n\n${params.text.slice(0, 30000)}` });
  } else {
    throw new Error("No resume content provided");
  }

  // Optional one-pager (goals / intent).
  if (params.onePagerPdfBase64) {
    parts.push({ inlineData: { mimeType: params.onePagerMimeType || "application/pdf", data: params.onePagerPdfBase64 } });
    parts.push({ text: "The document above is their ONE-PAGER (goals, what they want to work on, who they want to reach)." });
  } else if (params.onePagerText && params.onePagerText.trim().length > 0) {
    parts.push({ text: `ONE-PAGER (goals / intent):\n\n${params.onePagerText.slice(0, 20000)}` });
  }

  parts.push({ text: "Now produce the deep Creator Profile JSON, weaving the resume and (if present) the one-pager together." });

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: ANALYSIS_PROMPT,
      temperature: 0.6,
      responseMimeType: "application/json",
    },
    contents: [{ role: "user", parts }],
  });

  const raw = (response.text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const data = JSON.parse(raw) as CreatorProfileData;
  return data;
}

/**
 * Render a stored profile into a compact context block that gets injected into
 * every content-generation prompt so output is grounded in the client's resume.
 */
export function profileToContext(p: CreatorProfileData): string {
  const lines: string[] = [];
  lines.push(`CLIENT CREATOR PROFILE (use this as the foundation for all content — write AS this person, grounded in THEIR real experience):`);
  if (p.fullName) lines.push(`- Name: ${p.fullName}`);
  if (p.headline) lines.push(`- Positioning headline: ${p.headline}`);
  if (p.industry) lines.push(`- Industry: ${p.industry}`);
  if (p.targetAudience) lines.push(`- Target audience: ${p.targetAudience}`);
  if (p.summary) lines.push(`- Summary: ${p.summary}`);
  if (p.positioning) lines.push(`- Category-of-one angle: ${p.positioning}`);
  if (p.voiceTone) lines.push(`- Voice/tone: ${p.voiceTone}`);
  if (p.expertise?.length) lines.push(`- Expertise: ${p.expertise.join(", ")}`);
  if (p.achievements?.length) {
    lines.push(`- Real achievements:`);
    p.achievements.slice(0, 8).forEach((a) => lines.push(`   • ${a.text}${a.metric ? ` (${a.metric})` : ""}`));
  }
  if (p.roles?.length) {
    lines.push(`- Career:`);
    p.roles.slice(0, 6).forEach((r) => lines.push(`   • ${r.title}${r.company ? ` @ ${r.company}` : ""}${r.period ? ` (${r.period})` : ""}`));
  }
  if (p.signatureStories?.length) {
    lines.push(`- Signature stories to draw from:`);
    p.signatureStories.slice(0, 8).forEach((s) => lines.push(`   • ${s}`));
  }
  if (p.contentPillars?.length) {
    lines.push(`- Content pillars: ${p.contentPillars.map((c) => c.name).join(", ")}`);
  }
  if (p.goals) lines.push(`- Their GOAL (steer content toward this): ${p.goals}`);
  if (p.objectives?.length) lines.push(`- Objectives: ${p.objectives.join("; ")}`);
  if (p.contentStrategy) lines.push(`- Content strategy through-line: ${p.contentStrategy}`);
  return lines.join("\n");
}
