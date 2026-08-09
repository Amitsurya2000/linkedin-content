# LinkedIn Post Generator

An AI SaaS that turns your real experience into scroll-stopping LinkedIn content — posts, carousels, articles, and polls — each paired with a premium, on-brand visual.

## Highlights

- **Resume-first personalization** — upload your CV / one-pager once; every post, image sign-off, and article is written from your real background and voice.
- **Viral copy engine** — Google Gemini generates the hook, body, hashtags, CTA, "why this works", and alternative versions for each post.
- **Zero-typo premium images** — the AI only paints a clean editorial background (via Gathos); the app overlays all text and graphic accents with `sharp` + SVG, so there are never spelling mistakes on the visual.
- **Editorial variation system** — clean charcoal canvas × app-drawn accents (frame / icon / divider / index watermark) × layout × font = hundreds of unique-but-cohesive looks. Topic-matched line icons, gold keyword highlights, and an author sign-off pulled from the client's profile.
- **Carousels** — multi-slide decks with auto-fit text (nothing truncated).
- **Schedule & Post Now** — schedule any post to a functional calendar (drag to reschedule) or post now (copies the text and opens LinkedIn's composer).

## Stack

- Next.js 15 (App Router) · React · Tailwind v4
- Drizzle ORM + SQLite (better-sqlite3)
- NextAuth (credentials)
- Google Gemini (copy + resume analysis) · Gathos (text-free image backgrounds)
- `sharp` for server-side image composition

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:push              # create the SQLite schema
npm run dev                  # http://localhost:3060
```

Add your **Google Gemini** key in the app's **Settings** page (per-user, stored encrypted). Server-side **Gathos** keys go in `.env.local`.

## Scripts

- `npm run dev` — start the dev server (port 3060)
- `npm run build` / `npm run start` — production build & serve
- `npm run db:push` — apply the Drizzle schema to the database
- `npm run db:studio` — browse the database
