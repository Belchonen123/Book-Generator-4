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

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const limited = await checkRateLimit(auth.userId, "generate_outline");
  if (limited) return limited;

  const { bookId, sectionCount = 12 } = (await req.json()) as {
    bookId: Id<"books">;
    sectionCount?: number;
  };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });
  const refined = book.refinedIdea ?? {};

  const prompt = await resolvePromptForRoute(
    auth.token,
    "generate_outline",
    {
      sectionCount,
      title: book.title,
      genre: book.genre ?? "",
      tone: book.tone ?? "",
      premise: refined.premise ?? book.rawIdea ?? "",
      mainCharacter: refined.mainCharacter ?? "",
      centralConflict: refined.centralConflict ?? "",
    },
    bookId
  );

  const raw = await generateText({
    task: "generate_outline",
    messages: [{ role: "user", content: prompt }],
  });

  const sections = parseSections(raw);
  if (sections.length === 0) {
    return new Response("Failed to parse outline", { status: 502 });
  }

  await fetchMutation(
    api.outline.replaceAll,
    { bookId, sections },
    { token: auth.token }
  );
  return Response.json({ count: sections.length });
}

function parseSections(raw: string): Array<{ title: string; summary: string; notes?: string }> {
  const trimmed = raw.trim().replace(/^```(?:json)?\n?|```$/g, "");
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => ({
        title: typeof s?.title === "string" ? s.title : "",
        summary: typeof s?.summary === "string" ? s.summary : "",
        notes: typeof s?.notes === "string" ? s.notes : undefined,
      }))
      .filter((s) => s.title && s.summary);
  } catch {
    return [];
  }
}
