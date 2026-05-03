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

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "rewrite_transitions");
  if (limited) return limited;

  const { chapterAId, chapterBId } = (await req.json()) as {
    chapterAId: Id<"chapters">;
    chapterBId: Id<"chapters">;
  };

  const [a, b] = await Promise.all([
    fetchQuery(api.chapters.get, { id: chapterAId }, { token: auth.token }),
    fetchQuery(api.chapters.get, { id: chapterBId }, { token: auth.token }),
  ]);

  const endA = lastParagraph(a.plainText);
  const startB = firstParagraph(b.plainText);

  const prompt = await resolvePromptForRoute(
    auth.token,
    "rewrite_transitions",
    { endA, startB },
    a.bookId
  );

  const raw = await generateText({
    task: "rewrite_transitions",
    messages: [{ role: "user", content: prompt }],
  });

  let parsed: { endA?: string; startB?: string } = {};
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
  } catch {
    return new Response("Failed to parse rewrite", { status: 502 });
  }

  if (parsed.endA && parsed.endA !== endA) {
    const newPlain = replaceLastParagraph(a.plainText, parsed.endA);
    const { json, plain } = plainToTiptap(newPlain);
    await fetchMutation(
      api.chapters.saveContent,
      {
        id: chapterAId,
        content: json,
        plainText: plain,
        wordCount: countWords(plain),
        snapshotRevision: true,
        revisionSource: "rewrite_transition",
      },
      { token: auth.token }
    );
  }
  if (parsed.startB && parsed.startB !== startB) {
    const newPlain = replaceFirstParagraph(b.plainText, parsed.startB);
    const { json, plain } = plainToTiptap(newPlain);
    await fetchMutation(
      api.chapters.saveContent,
      {
        id: chapterBId,
        content: json,
        plainText: plain,
        wordCount: countWords(plain),
        snapshotRevision: true,
        revisionSource: "rewrite_transition",
      },
      { token: auth.token }
    );
  }

  return Response.json({ ok: true });
}

function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
function lastParagraph(text: string): string {
  const ps = paragraphs(text);
  return ps[ps.length - 1] ?? "";
}
function firstParagraph(text: string): string {
  return paragraphs(text)[0] ?? "";
}
function replaceLastParagraph(text: string, replacement: string): string {
  const ps = paragraphs(text);
  if (ps.length === 0) return replacement;
  ps[ps.length - 1] = replacement;
  return ps.join("\n\n");
}
function replaceFirstParagraph(text: string, replacement: string): string {
  const ps = paragraphs(text);
  if (ps.length === 0) return replacement;
  ps[0] = replacement;
  return ps.join("\n\n");
}
