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
  const limited = await checkRateLimit(auth.userId, "brainstorm");
  if (limited) return limited;

  const { sessionId, count = 12 } = (await req.json()) as {
    sessionId: Id<"brainstormSessions">;
    count?: number;
  };

  // Load session via the listSessions query path (ownership-checked).
  const sessionDoc = await fetchQuery(
    api.brainstorm._getSession,
    { id: sessionId },
    { token: auth.token }
  );
  const book = await fetchQuery(
    api.books.get,
    { id: sessionDoc.bookId },
    { token: auth.token }
  );

  const prompt = await resolvePromptForRoute(
    auth.token,
    "brainstorm",
    {
      bookTitle: book.title,
      genre: book.genre ?? "",
      count,
    },
    sessionDoc.bookId
  );

  const userMsg = sessionDoc.prompt
    ? `${sessionDoc.title}: ${sessionDoc.prompt}`
    : sessionDoc.title;

  const raw = await generateText({
    task: "brainstorm",
    messages: [{ role: "user", content: userMsg }],
    system: prompt,
  });

  const items = raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[-*•]\s*/, "")
        .replace(/^\s*\d+[.)]\s*/, "")
        .trim()
    )
    .filter(Boolean)
    .slice(0, Math.max(count, 20));

  await fetchMutation(
    api.brainstorm.appendItems,
    { sessionId, contents: items },
    { token: auth.token }
  );

  return Response.json({ added: items.length });
}
