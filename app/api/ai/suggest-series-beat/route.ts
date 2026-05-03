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
  const limited = await checkRateLimit(auth.userId, "suggest_series_beat");
  if (limited) return limited;

  const { beatId } = (await req.json()) as { beatId: Id<"seriesArcBeats"> };
  const beat = await fetchQuery(
    api.seriesArcs._getBeat,
    { id: beatId },
    { token: auth.token }
  );
  const arc = await fetchQuery(api.seriesArcs._getArc, { id: beat.arcId }, { token: auth.token });

  const prompt = `Flesh out a "${beat.kind}" beat for a series arc.
Arc: ${arc.name} (${arc.type})
Beat title: ${beat.title}
Existing description: ${beat.description ?? "—"}

Return a 2-3 sentence concrete description (not generic). Output prose only.`;

  const text = (
    await generateText({
      task: "suggest_series_beat",
      messages: [{ role: "user", content: prompt }],
    })
  ).trim();

  await fetchMutation(
    api.seriesArcs.updateBeat,
    { id: beatId, description: text },
    { token: auth.token }
  );
  return Response.json({ description: text });
}
