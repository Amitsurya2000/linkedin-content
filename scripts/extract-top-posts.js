// Pull the highest-engagement posts out of the 1,203-post dataset and write them
// out as verbatim few-shot examples for the generation prompt.
//
// Selection is TOP-N PER CREATOR, not top-N overall. Raw likes are dominated by
// audience size (Welsh averages 3,351, Barker 287) so a global sort would return
// almost nothing but Welsh and teach the model exactly one voice. Ranking inside
// each creator picks their personal best and keeps three distinct voices.
const fs = require("fs");

const SRC = process.argv[2];
const OUT = process.argv[3];
const PER_CREATOR = 7;
const MAX_CHARS = 1800; // keep the prompt affordable; long posts get truncated

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const posts = [];
let creator = null;
let cur = null;

for (const line of lines) {
  const h1 = /^# (.+)$/.exec(line);
  // "# LinkedIn Posts Dataset" is the file title, not a creator
  if (h1 && !/^LinkedIn Posts Dataset/.test(h1[1])) {
    creator = h1[1].trim();
    continue;
  }
  if (/^## Post \d+/.test(line)) {
    if (cur) posts.push(cur);
    cur = { creator, likes: 0, comments: 0, body: [] };
    continue;
  }
  const stats = /^\*\*Likes:\*\*\s*([\d,]+)\s*\|\s*\*\*Comments:\*\*\s*([\d,]+)/.exec(line);
  if (stats && cur) {
    cur.likes = parseInt(stats[1].replace(/,/g, ""), 10);
    cur.comments = parseInt(stats[2].replace(/,/g, ""), 10);
    continue;
  }
  if (cur && /^> ?/.test(line)) cur.body.push(line.replace(/^> ?/, ""));
}
if (cur) posts.push(cur);

// Keep only substantial posts from the three creators with real sample sizes.
const byCreator = {};
for (const p of posts) {
  const text = p.body.join("\n").trim();
  if (!text || text.length < 200) continue;
  (byCreator[p.creator] ||= []).push({ ...p, text });
}

const chosen = [];
for (const [name, list] of Object.entries(byCreator)) {
  if (list.length < 50) continue; // skip the 1-post creators
  list.sort((a, b) => b.likes - a.likes);
  chosen.push(...list.slice(0, PER_CREATOR));
}
chosen.sort((a, b) => b.likes - a.likes);

let md = `# TOP-PERFORMING POSTS — VERBATIM EXAMPLES

These are real LinkedIn posts, copied exactly as published, selected from a
dataset of 1,203 posts by engagement. They are the ${PER_CREATOR} best-performing
posts from each of the three creators with meaningful sample sizes.

Selection is per-creator, not global: raw like counts mostly reflect audience
size, so ranking within each creator surfaces their personal best and preserves
three distinct voices instead of cloning the one with the biggest following.

Study the RHYTHM: how short the opening line is, where the line breaks fall, how
much white space sits between beats, how the last line lands. Imitate the shape.
Never copy their sentences, their companies, or their numbers.

---

`;

for (const p of chosen) {
  const text = p.text.length > MAX_CHARS ? p.text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "") + "\n\n[…]" : p.text;
  const hook = p.text.split("\n").find((l) => l.trim()) || "";
  md += `## ${p.creator} — ${p.likes.toLocaleString()} likes, ${p.comments.toLocaleString()} comments\n`;
  md += `*Opening line is ${hook.trim().length} characters.*\n\n`;
  md += "```\n" + text.trim() + "\n```\n\n---\n\n";
}

fs.writeFileSync(OUT, md);

const hookLens = chosen.map((p) => (p.text.split("\n").find((l) => l.trim()) || "").trim().length);
console.log(`parsed posts:      ${posts.length}`);
console.log(`creators kept:     ${Object.keys(byCreator).filter((k) => byCreator[k].length >= 50).join(", ")}`);
console.log(`examples written:  ${chosen.length}`);
console.log(`likes range:       ${chosen[chosen.length - 1].likes.toLocaleString()} – ${chosen[0].likes.toLocaleString()}`);
console.log(`mean opening line: ${Math.round(hookLens.reduce((a, b) => a + b, 0) / hookLens.length)} chars`);
console.log(`file size:         ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB  (~${Math.round(fs.statSync(OUT).size / 4)} tokens)`);
