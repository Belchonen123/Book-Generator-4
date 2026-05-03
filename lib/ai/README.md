# AI provider layer

Foundation for every feature that calls a model. Phase-4 deliverable; the
actual route handlers (`/api/ai/generate-chapter`, `/api/ai/chat`, etc.)
land in later phases and all consume this module.

## Modules

- `clients.ts` — lazy SDK instances for Anthropic, OpenAI; ElevenLabs key.
- `models.ts` — model IDs and a `MODEL_ROUTING[task]` table mapping each
  AI task to a primary + fallback model chain.
- `stream.ts` — `streamCompletion(opts)` returns a `ReadableStream` you can
  hand to a Next.js route response. `generateText(opts)` is the
  non-streaming convenience for structured ops.
- `elevenlabs.ts` — `listVoices()`, `synthesize({ voiceId, text })`.
- `rate-limit.ts` — Upstash-backed sliding-window limiter, fails open in
  dev. Per-bucket hourly caps from the audit.
- `prompts.ts` — built-in default templates + `renderPrompt(template, vars)`.
- `server.ts` — wraps the typical route flow: `requireAuthedRoute()` →
  `checkRateLimit()` → `resolvePromptForRoute()`.

## Pattern for a new AI route

```ts
// app/api/ai/refine-idea/route.ts
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "refine_idea");
  if (limited) return limited;

  const { idea, genre, tone, bookId } = await req.json();
  const prompt = await resolvePromptForRoute(
    auth.token,
    "refine_idea",
    { idea, genre, tone },
    bookId
  );

  const text = await generateText({
    task: "refine_idea",
    messages: [{ role: "user", content: prompt }],
  });
  return Response.json(JSON.parse(text));
}
```

Streaming routes return `new Response(await streamCompletion(opts))`
directly.

## Prompt overrides

Resolution order: book-scoped → user-scoped → platform default →
`DEFAULT_PROMPTS`. Stored in `customPrompts` (user/book) and
`platformPrompts` (system). Custom prompt UI lands in Phase 24.
