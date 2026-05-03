import { fetchQuery } from "convex/nextjs";
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
  const limited = await checkRateLimit(auth.userId, "scene_beat");
  if (limited) return limited;

  const { chapterId, beat, context = "", targetWords = 400 } = (await req.json()) as {
    chapterId: Id<"chapters">;
    beat: string;
    context?: string;
    targetWords?: number;
  };
  const chapter = await fetchQuery(
    api.chapters.get,
    { id: chapterId },
    { token: auth.token }
  );
  const book = await fetchQuery(
    api.books.get,
    { id: chapter.bookId },
    { token: auth.token }
  );

  const prompt = await resolvePromptForRoute(
    auth.token,
    "scene_beat",
    {
      bookTitle: book.title,
      genre: book.genre ?? "",
      beat,
      context,
      targetWords,
      styleGuidance: book.styleGuidance ?? "",
    },
    chapter.bookId
  );

  const text = await generateText({
    task: "scene_beat",
    messages: [{ role: "user", content: prompt }],
  });
  return Response.json({ text });
}
