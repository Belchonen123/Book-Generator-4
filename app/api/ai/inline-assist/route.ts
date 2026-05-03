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
  const limited = await checkRateLimit(auth.userId, "inline_assist");
  if (limited) return limited;

  const { selection, context = "", op, bookId } = (await req.json()) as {
    selection: string;
    context?: string;
    op: string;
    bookId?: Id<"books">;
  };
  if (!selection?.trim()) return new Response("Empty selection", { status: 400 });

  const prompt = await resolvePromptForRoute(
    auth.token,
    "inline_assist",
    { op, selection, context },
    bookId
  );
  const text = (
    await generateText({
      task: "inline_assist",
      messages: [{ role: "user", content: prompt }],
    })
  ).trim();
  return Response.json({ text });
}
