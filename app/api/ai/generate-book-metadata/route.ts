import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateText } from "@/lib/ai/stream";
import { checkRateLimit, requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "generate_book_metadata");
  if (limited) return limited;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });

  const prompt = `Produce KDP-friendly metadata for the following book. Return JSON:
{ "keywords": [7 single-phrase keywords], "category": "...", "backCover": "150-200 word blurb" }

Title: ${book.title}
Genre: ${book.genre ?? ""}
Tone: ${book.tone ?? ""}
Premise: ${book.refinedIdea?.premise ?? book.rawIdea ?? ""}`;

  const raw = await generateText({
    task: "generate_book_metadata",
    messages: [{ role: "user", content: prompt }],
  });
  let parsed: { keywords?: string[]; category?: string; backCover?: string } = {};
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
  } catch {
    return new Response("Failed to parse metadata", { status: 502 });
  }

  await fetchMutation(
    api.metadata.updateMetadata,
    { bookId, patch: parsed },
    { token: auth.token }
  );
  return Response.json(parsed);
}
