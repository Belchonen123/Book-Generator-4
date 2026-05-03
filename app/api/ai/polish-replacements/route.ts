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

/**
 * Pro-tier follow-up to applyReplace: polish each affected chapter so the
 * substitutions read naturally. Each chapter is its own AI call + its own
 * revision snapshot.
 */
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "polish_replacements");
  if (limited) return limited;

  const me = await fetchQuery(api.profiles.me, {}, { token: auth.token });
  if (me?.profile?.subscriptionTier !== "pro") {
    return new Response("Pro tier required", { status: 402 });
  }

  const { chapterIds, needle, replacement } = (await req.json()) as {
    chapterIds: Id<"chapters">[];
    needle: string;
    replacement: string;
  };

  let polished = 0;
  for (const chapterId of chapterIds) {
    const chapter = await fetchQuery(
      api.chapters.get,
      { id: chapterId },
      { token: auth.token }
    );
    const prompt = await resolvePromptForRoute(
      auth.token,
      "polish_replacements",
      { needle, replacement, chapter: chapter.plainText },
      chapter.bookId
    );
    const text = await generateText({
      task: "polish_replacements",
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
        revisionSource: "find_replace",
        revisionNote: "polish after find/replace",
      },
      { token: auth.token }
    );
    polished++;
  }
  return Response.json({ polished });
}
