import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openai } from "@/lib/ai/clients";
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

/**
 * multipart/form-data: { audio: File, chapterId: string, targetWords?: number }
 * Whisper transcribes -> generate_chapter prompt builds polished prose ->
 * saved to the chapter as a fresh revision.
 */
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "voice_to_chapter");
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get("audio") as File | null;
  const chapterId = form.get("chapterId") as Id<"chapters"> | null;
  const targetWords = Number(form.get("targetWords") ?? 1500);
  if (!file || !chapterId) {
    return new Response("audio + chapterId required", { status: 400 });
  }

  const transcription = await openai().audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  const transcript = transcription.text ?? "";
  if (!transcript.trim()) {
    return new Response("Empty transcript", { status: 422 });
  }

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
    "voice_to_chapter",
    {
      bookTitle: book.title,
      genre: book.genre ?? "",
      targetWords,
      transcript,
      styleGuidance: book.styleGuidance ?? "",
    },
    chapter.bookId
  );

  const prose = await generateText({
    task: "voice_to_chapter",
    messages: [{ role: "user", content: prompt }],
    maxTokens: Math.min(8192, Math.ceil(targetWords * 1.5)),
  });

  const { json, plain } = plainToTiptap(prose);
  await fetchMutation(
    api.chapters.saveContent,
    {
      id: chapterId,
      content: json,
      plainText: plain,
      wordCount: countWords(plain),
      snapshotRevision: true,
      revisionSource: "regenerate",
      revisionNote: "voice-to-chapter",
    },
    { token: auth.token }
  );

  return Response.json({ ok: true, transcript, wordCount: countWords(plain) });
}
