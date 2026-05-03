import JSZip from "jszip";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireAuthedRoute } from "@/lib/ai/server";
import { buildEpub, type EpubChapter } from "@/lib/export/epub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Combines every book in the series into a single EPUB (one continuous
 * spine; books appear as top-level "Book N: Title" sections), plus a ZIP
 * containing the combined EPUB and a manifest. Pro-only.
 */
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const { seriesId } = (await req.json()) as { seriesId: Id<"series"> };
  const me = await fetchQuery(api.profiles.me, {}, { token: auth.token });
  if (me?.profile?.subscriptionTier !== "pro") {
    return new Response("Pro tier required", { status: 402 });
  }

  const series = await fetchQuery(api.series.get, { id: seriesId }, { token: auth.token });
  const books = await fetchQuery(
    api.series.booksInSeries,
    { seriesId },
    { token: auth.token }
  );
  if (books.length === 0) {
    return new Response("Series has no books", { status: 400 });
  }

  const author =
    me?.profile?.penName?.trim() || me?.profile?.fullName?.trim() || "Author";

  const allChapters: EpubChapter[] = [];
  let order = 1;
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const chapters = await fetchQuery(
      api.chapters.listForBook,
      { bookId: book._id },
      { token: auth.token }
    );
    // Synthetic title chapter for each book.
    allChapters.push({
      order: order++,
      title: `Book ${i + 1}: ${book.title}`,
      paragraphs: [book.refinedIdea?.premise ?? ""].filter(Boolean),
    });
    for (const c of chapters
      .filter((ch) => ch.plainText.trim())
      .sort((a, b) => a.order - b.order)) {
      allChapters.push({
        order: order++,
        title: c.title,
        paragraphs: c.plainText
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean),
      });
    }
  }

  const epubBytes = await buildEpub({
    title: series.name,
    subtitle: "Boxed set",
    author,
    genre: series.genre,
    description: series.description,
    chapters: allChapters,
  });

  const zip = new JSZip();
  zip.file(`${slug(series.name)}-boxed-set.epub`, epubBytes);
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        series: series.name,
        author,
        bookCount: books.length,
        books: books.map((b) => ({ order: b.seriesOrder, title: b.title })),
      },
      null,
      2
    )
  );
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  // Upload + record on the FIRST book so it shows up in that book's exports
  // list. (No series-level export table — boxedSet uses bookExports format.)
  const firstBook = books[0];
  const uploadUrl = await fetchMutation(
    api.bookExports.generateUploadUrl,
    {},
    { token: auth.token }
  );
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zipBytes,
  });
  if (!upload.ok) return new Response("Upload failed", { status: 502 });
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
  await fetchMutation(
    api.bookExports.record,
    {
      bookId: firstBook._id,
      format: "boxed_set",
      storageId,
      sizeBytes: zipBytes.byteLength,
    },
    { token: auth.token }
  );
  // Series-level analytics handled in bookExports.record? No — emit here.
  await fetchMutation(
    api.series.update,
    { id: seriesId, status: series.status }, // touch updatedAt
    { token: auth.token }
  );

  return Response.json({ storageId, sizeBytes: zipBytes.byteLength });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "series";
}
