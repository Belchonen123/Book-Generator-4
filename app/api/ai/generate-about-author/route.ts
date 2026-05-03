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
  const limited = await checkRateLimit(auth.userId, "generate_about_author");
  if (limited) return limited;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const [book, me] = await Promise.all([
    fetchQuery(api.books.get, { id: bookId }, { token: auth.token }),
    fetchQuery(api.profiles.me, {}, { token: auth.token }),
  ]);
  const profile = me?.profile;
  const name = profile?.penName?.trim() || profile?.fullName?.trim() || "Author";

  const prompt = `Write a tight 80-120 word "About the author" blurb for the back of a book.
Third person, warm but professional. Mention only details supplied.

Author name: ${name}
Bio fragments: ${profile?.bio ?? ""}
Location: ${profile?.location ?? ""}
Website: ${profile?.website ?? ""}
This book: "${book.title}" (${book.genre ?? "fiction"})

Output the prose only.`;

  const text = (
    await generateText({
      task: "generate_about_author",
      messages: [{ role: "user", content: prompt }],
    })
  ).trim();

  await fetchMutation(
    api.metadata.updateMetadata,
    { bookId, patch: { aboutAuthor: text } },
    { token: auth.token }
  );
  return Response.json({ aboutAuthor: text });
}
