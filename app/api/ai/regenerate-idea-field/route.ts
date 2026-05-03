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

const FIELDS = [
  "premise",
  "mainCharacter",
  "stakes",
  "centralConflict",
  "readerArc",
] as const;
type Field = (typeof FIELDS)[number];

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "regenerate_idea_field");
  if (limited) return limited;

  const { bookId, field } = (await req.json()) as {
    bookId: Id<"books">;
    field: Field;
  };
  if (!FIELDS.includes(field)) {
    return new Response("Bad field", { status: 400 });
  }

  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });
  const existing = { ...(book.refinedIdea ?? {}) };
  delete (existing as Record<string, unknown>)[field];

  const prompt = await resolvePromptForRoute(
    auth.token,
    "regenerate_idea_field",
    {
      field,
      existingJson: JSON.stringify(existing),
      genre: book.genre ?? "",
      tone: book.tone ?? "",
    },
    bookId
  );

  const value = (
    await generateText({
      task: "regenerate_idea_field",
      messages: [{ role: "user", content: prompt }],
    })
  ).trim();

  await fetchMutation(
    api.idea.updateRefinedField,
    { bookId, field, value },
    { token: auth.token }
  );
  return Response.json({ field, value });
}
