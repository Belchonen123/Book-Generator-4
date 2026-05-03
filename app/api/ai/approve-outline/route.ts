import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateText } from "@/lib/ai/stream";
import {
  checkRateLimit,
  requireAuthedRoute,
  resolvePromptForRoute,
} from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve outline + auto-generate the character bible. Two side effects in
 * one request because the bible depends on the just-approved outline.
 */
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "generate_character_bible");
  if (limited) return limited;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };

  await fetchMutation(api.outline.approve, { bookId }, { token: auth.token });

  const [book, sections] = await Promise.all([
    fetchQuery(api.books.get, { id: bookId }, { token: auth.token }),
    fetchQuery(api.outline.list, { bookId }, { token: auth.token }),
  ]);

  const outlineText = sections
    .map((s, i) => `${i + 1}. ${s.title}\n${s.summary}`)
    .join("\n\n");

  const prompt = await resolvePromptForRoute(
    auth.token,
    "generate_character_bible",
    {
      title: book.title,
      genre: book.genre ?? "",
      premise: book.refinedIdea?.premise ?? "",
      outline: outlineText,
    },
    bookId
  );

  const bible = await generateText({
    task: "generate_character_bible",
    messages: [{ role: "user", content: prompt }],
  });

  await fetchMutation(
    api.outline.upsertCharacterBible,
    { bookId, content: bible },
    { token: auth.token }
  );

  return Response.json({ ok: true, sectionCount: sections.length });
}
