import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateText } from "@/lib/ai/stream";
import { checkRateLimit, requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "suggest_series_arc");
  if (limited) return limited;

  const { arcId } = (await req.json()) as { arcId: Id<"seriesArcs"> };
  const arc = await fetchQuery(api.seriesArcs._getArc, { id: arcId }, { token: auth.token });
  const series = await fetchQuery(api.series.get, { id: arc.seriesId }, { token: auth.token });
  const books = await fetchQuery(
    api.series.booksInSeries,
    { seriesId: arc.seriesId },
    { token: auth.token }
  );

  const prompt = `Flesh out a series-level ${arc.type} arc named "${arc.name}".
Series: ${series.name} (${series.genre ?? "—"})
Books in series:
${books.map((b, i) => `${i + 1}. ${b.title} — ${b.refinedIdea?.premise ?? ""}`).join("\n")}

Existing description: ${arc.description ?? "—"}

Return JSON: { "description": "2-4 sentences", "status": "setup|developing|climax|resolved|abandoned" }.`;

  const raw = await generateText({
    task: "suggest_series_arc",
    messages: [{ role: "user", content: prompt }],
  });
  let parsed: { description?: string; status?: string } = {};
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
  } catch {
    return new Response("Failed to parse", { status: 502 });
  }
  const validStatuses = ["setup", "developing", "climax", "resolved", "abandoned"];
  await fetchMutation(
    api.seriesArcs.updateArc,
    {
      id: arcId,
      description: parsed.description,
      status: validStatuses.includes(parsed.status ?? "")
        ? (parsed.status as "setup" | "developing" | "climax" | "resolved" | "abandoned")
        : undefined,
    },
    { token: auth.token }
  );
  return Response.json(parsed);
}
