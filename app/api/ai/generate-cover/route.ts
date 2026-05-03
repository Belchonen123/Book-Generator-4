import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openai } from "@/lib/ai/clients";
import { checkRateLimit, requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "generate_cover");
  if (limited) return limited;

  const { bookId, prompt: userPrompt } = (await req.json()) as {
    bookId: Id<"books">;
    prompt?: string;
  };

  const book = await fetchQuery(
    api.books.get,
    { id: bookId },
    { token: auth.token }
  );

  const description = userPrompt?.trim()
    ? userPrompt
    : [
        `Book cover for "${book.title}"`,
        book.subtitle ? `Subtitle: ${book.subtitle}.` : "",
        book.genre ? `Genre: ${book.genre}.` : "",
        book.tone ? `Tone: ${book.tone}.` : "",
        book.refinedIdea?.premise ? `Premise: ${book.refinedIdea.premise}` : "",
        "Cinematic, evocative, no on-cover text.",
      ]
        .filter(Boolean)
        .join(" ");

  const result = await openai().images.generate({
    model: "dall-e-3",
    prompt: description,
    n: 1,
    size: "1024x1792",
    response_format: "b64_json",
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) return new Response("No image returned", { status: 502 });
  const buffer = Buffer.from(b64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });

  const uploadUrl = await fetchMutation(
    api.covers.generateUploadUrl,
    {},
    { token: auth.token }
  );
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
  if (!upload.ok) {
    return new Response("Upload failed", { status: 502 });
  }
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };

  await fetchMutation(
    api.covers.recordVariant,
    {
      bookId,
      storageId,
      source: "ai",
      prompt: description,
      width: 1024,
      height: 1792,
      setActive: true,
    },
    { token: auth.token }
  );

  return Response.json({ storageId });
}
