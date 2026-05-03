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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "analyze_beats");
  if (limited) return limited;

  const { bookId, force = false } = (await req.json()) as {
    bookId: Id<"books">;
    force?: boolean;
  };

  const chapters = await fetchQuery(
    api.chapters.listForBook,
    { bookId },
    { token: auth.token }
  );
  const haystack = chapters
    .map((c) => `# Chapter ${c.order}: ${c.title}\n${c.plainText}`)
    .join("\n\n");
  const contentHash = sha256(haystack);

  if (!force) {
    const cached = await fetchQuery(
      api.pacing.getCached,
      { bookId, contentHash },
      { token: auth.token }
    );
    if (cached) {
      return Response.json({ ...cached.result, cached: true });
    }
  }

  const prompt = await resolvePromptForRoute(
    auth.token,
    "analyze_beats",
    { book: haystack },
    bookId
  );
  const raw = await generateText({
    task: "analyze_beats",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 8192,
  });

  let result: Record<string, unknown> = {};
  try {
    result = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
  } catch {
    return new Response("Failed to parse beats", { status: 502 });
  }

  await fetchMutation(
    api.pacing.saveResult,
    { bookId, contentHash, result },
    { token: auth.token }
  );
  return Response.json({ ...result, cached: false });
}
