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

const FIELD_SCHEMAS: Record<string, string[]> = {
  character: ["role", "age", "appearance", "voice", "motivation", "secrets", "arc"],
  location: ["region", "vibe", "notable_features", "history"],
  object: ["origin", "appearance", "significance"],
  faction: ["leader", "ideology", "members", "rivals"],
  lore: ["scope", "rules"],
  subplot: ["stakes", "resolution"],
};

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "suggest_codex_entry");
  if (limited) return limited;

  const { entryId } = (await req.json()) as { entryId: Id<"codexEntries"> };
  const entry = await fetchQuery(
    api.codex.get,
    { id: entryId },
    { token: auth.token }
  );
  const book = await fetchQuery(
    api.books.get,
    { id: entry.bookId },
    { token: auth.token }
  );

  const schema = FIELD_SCHEMAS[entry.type] ?? [];
  const context = [
    book.refinedIdea?.premise ?? book.rawIdea ?? "",
    book.refinedIdea?.centralConflict ?? "",
    entry.summary ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = await resolvePromptForRoute(
    auth.token,
    "suggest_codex_entry",
    {
      schema: schema.join(", "),
      name: entry.name,
      type: entry.type,
      existingJson: JSON.stringify(entry.fields ?? {}),
      context,
    },
    entry.bookId
  );

  const raw = await generateText({
    task: "suggest_codex_entry",
    messages: [{ role: "user", content: prompt }],
  });

  let suggested: Record<string, unknown> = {};
  try {
    suggested = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
  } catch {
    return new Response("Failed to parse suggestion", { status: 502 });
  }

  await fetchMutation(
    api.codex.update,
    {
      id: entryId,
      fields: { ...(entry.fields ?? {}), ...suggested },
    },
    { token: auth.token }
  );
  return Response.json({ fields: suggested });
}
