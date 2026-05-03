# Book Generator 4

AI-assisted book writing platform — rebuilt on **Next.js 15 + Convex** from the
Supabase-based original.

## Stack

- Next.js 15 (App Router, React 19)
- Convex (database, functions, realtime, file storage)
- Convex Auth (email/password + Google OAuth)
- Tailwind CSS + shadcn/ui
- Anthropic Claude + OpenAI + ElevenLabs
- Stripe (Pro tier)
- Upstash Redis (rate limiting)

## Getting started

```bash
cp .env.example .env.local
npm install
npx convex dev   # in one terminal
npm run dev      # in another
```

## Build plan

Rebuild proceeds in 28 ordered phases. Phase 0 (this commit) bootstraps the
project shell. Subsequent phases each add one vertical slice of functionality
mapped from the original app — see commit history for progression.
