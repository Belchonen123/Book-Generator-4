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

  const limited = await checkRateLimit(auth.userId, "expand_outline");
  if (limited) return limited;

  const { sectionId } = (await req.json()) as { sectionId: Id<"outlineSections"> };

  const sections = await fetchQuery(
    api.outline.list,
    { bookId: undefined as unknown as Id<"books"> }, // placeholder, replaced below
    { token: auth.token }
  ).catch(() => null);
  void sections;

  // Load the section directly via the sections list once we know its book.
  const section = await fetchQuery(
    api.outline._getSection,
    { id: sectionId },
    { token: auth.token }
  );

  const book = await fetchQuery(
    api.books.get,
    { id: section.bookId },
    { token: auth.token }
  );

  const prompt = await resolvePromptForRoute(
    auth.token,
    "expand_outline",
    {
      title: section.title,
      summary: section.summary,
      bookContext: `${book.title} — ${book.genre ?? ""}. ${book.refinedIdea?.premise ?? ""}`,
    },
    section.bookId
  );

  const raw = await generateText({
    task: "expand_outline",
    messages: [{ role: "user", content: prompt }],
  });

  const parsed = safeJson(raw);
  const summary =
    typeof parsed?.summary === "string" ? parsed.summary : raw.trim();
  const notes = typeof parsed?.notes === "string" ? parsed.notes : undefined;

  await fetchMutation(
    api.outline.update,
    { id: sectionId, summary, notes },
    { token: auth.token }
  );
  return Response.json({ summary, notes });
}

function safeJson(raw: string): { summary?: string; notes?: string } | null {
  const t = raw.trim().replace(/^```(?:json)?\n?|```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
