# LinkedIn Post Generator

An AI SaaS that turns your real experience into scroll-stopping LinkedIn content — posts, carousels, articles, and polls — each paired with a premium, on-brand visual.

## Highlights

- **Resume-first personalization** — upload your CV / one-pager once; every post, image sign-off, and article is written from your real background and voice.
- **Viral copy engine** — Google Gemini generates the hook, body, hashtags, CTA, "why this works", and alternative versions for each post.
- **Zero-typo premium images** — Gemini only paints or alters a clean editorial background; the app overlays all text and graphic accents with `sharp` + SVG, so there are never spelling mistakes on the visual.
- **Real photos, on demand** — carousel and article images can start from a real photo searched for the slide's own subject, then get altered by Gemini to match the deck's art direction, instead of a fully synthesised picture.
- **Editorial variation system** — clean charcoal canvas × app-drawn accents (frame / icon / divider / index watermark) × layout × font = hundreds of unique-but-cohesive looks. Topic-matched line icons, gold keyword highlights, and an author sign-off pulled from the client's profile.
- **Carousels** — multi-slide decks with auto-fit text (nothing truncated).
- **Schedule & Post Now** — schedule any post to a functional calendar (drag to reschedule) or post now (copies the text and opens LinkedIn's composer).

## Stack

- Next.js 15 (App Router) · React · Tailwind v4
- Drizzle ORM + PostgreSQL (Supabase via Neon serverless driver)
- NextAuth (credentials)
- Google Gemini (copy + resume analysis + image generation/editing) · Pexels / Tavily (real photo search, optional)
- `sharp` for server-side image composition

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:push              # apply the PostgreSQL schema (needs DATABASE_URL)
npm run dev                  # http://localhost:3060
```

Add your **Google Gemini** key in the app's **Settings** page (per-user, stored encrypted) — it is the only key required. Optional server-side **Pexels** / **Tavily** keys in `.env.local` add real photo search on top of it.

## Scripts

- `npm run dev` — start the dev server (port 3060)
- `npm run build` / `npm run start` — production build & serve
- `npm run db:push` — apply the Drizzle schema to the database
- `npm run db:studio` — browse the database
