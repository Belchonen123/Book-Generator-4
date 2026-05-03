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

const VALID_TYPES = new Set([
  "character",
  "location",
  "object",
  "lore",
  "faction",
  "subplot",
]);

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "extract_codex_seeds");
  if (limited) return limited;

  const { chapterId } = (await req.json()) as { chapterId: Id<"chapters"> };
  const chapter = await fetchQuery(
    api.chapters.get,
    { id: chapterId },
    { token: auth.token }
  );

  const prompt = await resolvePromptForRoute(
    auth.token,
    "extract_codex_seeds",
    { chapter: chapter.plainText },
    chapter.bookId
  );
  const raw = await generateText({
    task: "extract_codex_seeds",
    messages: [{ role: "user", content: prompt }],
  });

  let seeds: Array<{
    type: string;
    name: string;
    summary?: string;
  }> = [];
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
    if (Array.isArray(parsed)) seeds = parsed;
  } catch {
    return Response.json({ inserted: 0, seeds: [] });
  }

  const valid = seeds
    .filter((s) => s && typeof s.name === "string" && s.name.trim() && VALID_TYPES.has(s.type))
    .map((s) => ({
      type: s.type as "character" | "location" | "object" | "lore" | "faction" | "subplot",
      name: s.name.trim(),
      summary: typeof s.summary === "string" ? s.summary : undefined,
    }));

  const result = await fetchMutation(
    api.codex.bulkUpsertSeeds,
    { bookId: chapter.bookId, seeds: valid },
    { token: auth.token }
  );
  return Response.json({ ...result, seeds: valid });
}
