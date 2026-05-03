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

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "generate_subtitle");
  if (limited) return limited;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });

  const prompt = await resolvePromptForRoute(
    auth.token,
    "generate_subtitle",
    {
      title: book.title,
      genre: book.genre ?? "",
      premise: book.refinedIdea?.premise ?? book.rawIdea ?? "",
    },
    bookId
  );

  const subtitle = (
    await generateText({
      task: "generate_subtitle",
      messages: [{ role: "user", content: prompt }],
    })
  )
    .trim()
    .replace(/^["']|["']$/g, "");

  await fetchMutation(api.idea.setSubtitle, { bookId, subtitle }, { token: auth.token });
  return Response.json({ subtitle });
}
