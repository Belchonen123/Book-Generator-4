import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateText } from "@/lib/ai/stream";
import {
  checkRateLimit,
  requireAuthedRoute,
  resolvePromptForRoute,
} from "@/lib/ai/server";
import { plainToTiptap } from "@/lib/text/tiptap";
import { wordCount as countWords } from "@/lib/text/word-count";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Op = "expand" | "tighten" | "tone";

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "chapter_assist");
  if (limited) return limited;

  const { chapterId, op, detail = "" } = (await req.json()) as {
    chapterId: Id<"chapters">;
    op: Op;
    detail?: string;
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
    "chapter_assist",
    {
      op,
      opDetail: detail,
      styleGuidance: book.styleGuidance ?? "",
      chapter: chapter.plainText || chapter.content,
    },
    chapter.bookId
  );

  const text = await generateText({
    task: "chapter_assist",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 8192,
  });

  const { json, plain } = plainToTiptap(text);
  await fetchMutation(
    api.chapters.saveContent,
    {
      id: chapterId,
      content: json,
      plainText: plain,
      wordCount: countWords(plain),
      snapshotRevision: true,
      revisionSource: op === "tone" ? "assist_tone" : "assist_expand",
    },
    { token: auth.token }
  );
  return Response.json({ ok: true, wordCount: countWords(plain) });
}
