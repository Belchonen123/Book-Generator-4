import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateText } from "@/lib/ai/stream";
import {
  checkRateLimit,
  requireAuthedRoute,
  resolvePromptForRoute,
} from "@/lib/ai/server";
import { sha256 } from "@/lib/text/hash";
import { scanText } from "@/lib/text/slop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const { chapterId, deepdive = false } = (await req.json()) as {
    chapterId: Id<"chapters">;
    deepdive?: boolean;
  };

  const chapter = await fetchQuery(
    api.chapters.get,
    { id: chapterId },
    { token: auth.token }
  );

  const contentHash = sha256(chapter.plainText);
  const regexHits = scanText(chapter.plainText);

  let deepdiveResult: unknown = undefined;
  if (deepdive) {
    const limited = await checkRateLimit(auth.userId, "slop_scan_deepdive");
    if (limited) return limited;

    const prompt = await resolvePromptForRoute(
      auth.token,
      "slop_scan_deepdive",
      { chapter: chapter.plainText },
      chapter.bookId
    );
    const raw = await generateText({
      task: "slop_scan_deepdive",
      messages: [{ role: "user", content: prompt }],
    });
    try {
      deepdiveResult = JSON.parse(
        raw.trim().replace(/^```(?:json)?\n?|```$/g, "")
      );
    } catch {
      deepdiveResult = { raw };
    }
  }

  await fetchMutation(
    api.slop.saveResult,
    {
      chapterId,
      contentHash,
      regexHits,
      deepdive: deepdiveResult,
    },
    { token: auth.token }
  );

  return Response.json({
    regexHits,
    deepdive: deepdiveResult,
    contentHash,
  });
}
