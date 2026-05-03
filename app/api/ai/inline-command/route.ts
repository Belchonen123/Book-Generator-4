import { generateText } from "@/lib/ai/stream";
import {
  checkRateLimit,
  requireAuthedRoute,
  resolvePromptForRoute,
} from "@/lib/ai/server";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "inline_command");
  if (limited) return limited;

  const { selection, instruction, count = 3, bookId } = (await req.json()) as {
    selection: string;
    instruction: string;
    count?: number;
    bookId?: Id<"books">;
  };
  if (!selection?.trim()) return new Response("Empty selection", { status: 400 });

  const prompt = await resolvePromptForRoute(
    auth.token,
    "inline_command",
    { selection, instruction, count },
    bookId
  );
  const raw = await generateText({
    task: "inline_command",
    messages: [{ role: "user", content: prompt }],
  });
  let alternatives: string[] = [];
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
    if (Array.isArray(parsed)) alternatives = parsed.filter((x) => typeof x === "string");
  } catch {
    alternatives = [raw.trim()];
  }
  return Response.json({ alternatives });
}
