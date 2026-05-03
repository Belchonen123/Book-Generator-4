import { fetchMutation } from "convex/nextjs";
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

  const limited = await checkRateLimit(auth.userId, "refine_idea");
  if (limited) return limited;

  const { bookId, idea, genre, tone } = (await req.json()) as {
    bookId: Id<"books">;
    idea: string;
    genre?: string;
    tone?: string;
  };
  if (!idea?.trim()) return new Response("Missing idea", { status: 400 });

  const prompt = await resolvePromptForRoute(
    auth.token,
    "refine_idea",
    { idea, genre: genre ?? "", tone: tone ?? "" },
    bookId
  );

  const raw = await generateText({
    task: "refine_idea",
    messages: [{ role: "user", content: prompt }],
  });

  const refined = parseRefinedIdea(raw);
  await fetchMutation(
    api.idea.saveRefinedIdea,
    { bookId, refinedIdea: refined, advanceStatus: true },
    { token: auth.token }
  );
  return Response.json(refined);
}

function parseRefinedIdea(raw: string): {
  premise?: string;
  mainCharacter?: string;
  stakes?: string;
  centralConflict?: string;
  readerArc?: string;
} {
  const trimmed = raw.trim();
  const cleaned = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\n/, "").replace(/```$/, "")
    : trimmed;
  try {
    const parsed = JSON.parse(cleaned);
    return {
      premise: typeof parsed.premise === "string" ? parsed.premise : undefined,
      mainCharacter:
        typeof parsed.mainCharacter === "string" ? parsed.mainCharacter : undefined,
      stakes: typeof parsed.stakes === "string" ? parsed.stakes : undefined,
      centralConflict:
        typeof parsed.centralConflict === "string" ? parsed.centralConflict : undefined,
      readerArc: typeof parsed.readerArc === "string" ? parsed.readerArc : undefined,
    };
  } catch {
    return { premise: trimmed };
  }
}
