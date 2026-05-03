import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { streamCompletion } from "@/lib/ai/stream";
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

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "generate_chapter");
  if (limited) return limited;

  const { chapterId, targetWords = 2500 } = (await req.json()) as {
    chapterId: Id<"chapters">;
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
  const sections = await fetchQuery(
    api.outline.list,
    { bookId: chapter.bookId },
    { token: auth.token }
  );
  const styleExamples = await fetchQuery(
    api.style.list,
    { bookId: chapter.bookId },
    { token: auth.token }
  );

  const outlineSection = sections.find((s) => s.order === chapter.order);
  const priorChapter = sections.find((s) => s.order === chapter.order - 1);

  // Pull codex entries that should accompany this chapter (always-scope +
  // any match-scope entry whose name appears in the outline summary).
  const codexHaystack = [
    outlineSection?.title ?? "",
    outlineSection?.summary ?? "",
    chapter.title,
  ].join(" ");
  const codex = await fetchQuery(
    api.codex.contextForGeneration,
    { bookId: chapter.bookId, haystack: codexHaystack },
    { token: auth.token }
  );
  const codexContext = codex
    .map(
      (e) =>
        `- ${e.type.toUpperCase()} ${e.name}${
          e.summary ? `: ${e.summary}` : ""
        }`
    )
    .join("\n");

  const prompt = await resolvePromptForRoute(
    auth.token,
    "generate_chapter",
    {
      chapterNumber: chapter.order,
      bookTitle: book.title,
      genre: book.genre ?? "",
      tone: book.tone ?? "",
      styleGuidance: [
        book.styleGuidance ?? "",
        ...styleExamples.map((e) => `EXAMPLE${e.label ? ` (${e.label})` : ""}:\n${e.content}`),
      ]
        .filter(Boolean)
        .join("\n\n"),
      outlineTitle: outlineSection?.title ?? chapter.title,
      outlineSummary: outlineSection?.summary ?? "",
      codexContext,
      priorChapterSummary: priorChapter?.summary ?? "",
      targetWords,
    },
    chapter.bookId
  );

  await fetchMutation(
    api.chapters.beginGeneration,
    { id: chapterId },
    { token: auth.token }
  );

  let buffer = "";
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await streamCompletion({
      task: "generate_chapter",
      messages: [{ role: "user", content: prompt }],
      maxTokens: Math.min(8192, Math.ceil(targetWords * 1.5)),
    });
  } catch (err) {
    await fetchMutation(
      api.chapters.failGeneration,
      { id: chapterId, error: err instanceof Error ? err.message : "Unknown" },
      { token: auth.token }
    );
    throw err;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
          }
        }
        buffer += decoder.decode();
        const { json, plain } = plainToTiptap(buffer);
        await fetchMutation(
          api.chapters.completeGeneration,
          {
            id: chapterId,
            content: json,
            plainText: plain,
            wordCount: countWords(plain),
          },
          { token: auth.token }
        );
        controller.close();
      } catch (err) {
        await fetchMutation(
          api.chapters.failGeneration,
          { id: chapterId, error: err instanceof Error ? err.message : "Unknown" },
          { token: auth.token }
        );
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
