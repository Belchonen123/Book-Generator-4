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
  const limited = await checkRateLimit(auth.userId, "generate_back_cover");
  if (limited) return limited;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });

  const prompt = `Write the back-cover marketing copy for the following book. 150-200 words.
Open with a hook, raise stakes, end with a one-line cliffhanger. No spoilers.

Title: ${book.title}
Genre: ${book.genre ?? ""}
Premise: ${book.refinedIdea?.premise ?? book.rawIdea ?? ""}
Stakes: ${book.refinedIdea?.stakes ?? ""}
Conflict: ${book.refinedIdea?.centralConflict ?? ""}

Output prose only.`;

  const text = (
    await generateText({
      task: "generate_back_cover",
      messages: [{ role: "user", content: prompt }],
    })
  ).trim();

  await fetchMutation(
    api.metadata.updateMetadata,
    { bookId, patch: { backCover: text } },
    { token: auth.token }
  );
  return Response.json({ backCover: text });
}
