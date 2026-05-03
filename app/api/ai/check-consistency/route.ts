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

const SEVERITIES = new Set(["info", "warn", "error"]);

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "check_consistency");
  if (limited) return limited;

  const { chapterId } = (await req.json()) as { chapterId: Id<"chapters"> };

  const chapter = await fetchQuery(
    api.chapters.get,
    { id: chapterId },
    { token: auth.token }
  );
  const [chapters, sections, codex] = await Promise.all([
    fetchQuery(api.chapters.listForBook, { bookId: chapter.bookId }, { token: auth.token }),
    fetchQuery(api.outline.list, { bookId: chapter.bookId }, { token: auth.token }),
    fetchQuery(
      api.codex.contextForGeneration,
      { bookId: chapter.bookId, haystack: chapter.plainText },
      { token: auth.token }
    ),
  ]);

  const priorSummaries = chapters
    .filter((c) => c.order < chapter.order)
    .map(
      (c) => `Chapter ${c.order} (${c.title}): ${c.summary ?? sections.find((s) => s.order === c.order)?.summary ?? "—"}`
    )
    .join("\n");

  const codexBlock = codex
    .map((e) => `${e.type.toUpperCase()} ${e.name}${e.summary ? `: ${e.summary}` : ""}`)
    .join("\n");

  const prompt = await resolvePromptForRoute(
    auth.token,
    "check_consistency",
    {
      codex: codexBlock,
      priorSummaries,
      chapter: chapter.plainText,
    },
    chapter.bookId
  );

  const raw = await generateText({
    task: "check_consistency",
    messages: [{ role: "user", content: prompt }],
  });

  let parsed: Array<{
    title?: string;
    detail?: string;
    severity?: string;
  }> = [];
  try {
    const decoded = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
    if (Array.isArray(decoded)) parsed = decoded;
  } catch {
    return new Response("Failed to parse warnings", { status: 502 });
  }

  const warnings = parsed
    .filter(
      (w) =>
        w &&
        typeof w.title === "string" &&
        typeof w.detail === "string" &&
        typeof w.severity === "string" &&
        SEVERITIES.has(w.severity)
    )
    .map((w) => ({
      severity: w.severity as "info" | "warn" | "error",
      title: w.title!,
      detail: w.detail!,
    }));

  const result = await fetchMutation(
    api.continuity.replaceForChapter,
    { chapterId, warnings },
    { token: auth.token }
  );
  return Response.json(result);
}
