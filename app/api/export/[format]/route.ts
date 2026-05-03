import JSZip from "jszip";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireAuthedRoute } from "@/lib/ai/server";
import { buildEpub, type EpubChapter } from "@/lib/export/epub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Format = "epub" | "pdf" | "kdp";

export async function POST(req: Request, ctx: { params: Promise<{ format: string }> }) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const { format } = await ctx.params;
  if (format !== "epub" && format !== "pdf" && format !== "kdp") {
    return new Response("Unsupported format", { status: 400 });
  }

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });
  const me = await fetchQuery(api.profiles.me, {}, { token: auth.token });
  const chapters = await fetchQuery(
    api.chapters.listForBook,
    { bookId },
    { token: auth.token }
  );

  const author =
    me?.profile?.penName?.trim() ||
    me?.profile?.fullName?.trim() ||
    "Author";

  const epubChapters: EpubChapter[] = chapters
    .filter((c) => c.plainText.trim())
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      order: c.order,
      title: c.title,
      paragraphs: c.plainText
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    }));

  let cover: { bytes: Uint8Array; mime: string } | undefined;
  if (book.coverStorageId) {
    const active = await fetchQuery(
      api.covers.getActive,
      { bookId },
      { token: auth.token }
    );
    if (active?.url) {
      const res = await fetch(active.url);
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/png";
      cover = { bytes: buf, mime };
    }
  }

  const epubBytes = await buildEpub({
    title: book.title,
    subtitle: book.subtitle,
    author,
    genre: book.genre,
    description: book.metadata?.backCover ?? book.refinedIdea?.premise,
    chapters: epubChapters,
    cover,
  });

  const finalFormat: Format = format as Format;
  let payload: Uint8Array;
  let mime: string;
  if (finalFormat === "kdp") {
    const zip = new JSZip();
    zip.file(`${slug(book.title)}.epub`, epubBytes);
    if (cover) {
      zip.file(`cover.${cover.mime === "image/jpeg" ? "jpg" : "png"}`, cover.bytes);
    }
    zip.file(
      "metadata.json",
      JSON.stringify(
        {
          title: book.title,
          subtitle: book.subtitle,
          author,
          genre: book.genre,
          keywords: book.metadata?.keywords ?? [],
          category: book.metadata?.category,
          description: book.metadata?.backCover,
          aboutAuthor: book.metadata?.aboutAuthor,
        },
        null,
        2
      )
    );
    payload = await zip.generateAsync({ type: "uint8array" });
    mime = "application/zip";
  } else if (finalFormat === "pdf") {
    // Simple printable HTML; user prints to PDF from the browser. Returned
    // inline so the route can be opened in a tab as well.
    const html = printableHtml(book.title, author, epubChapters);
    payload = new TextEncoder().encode(html);
    mime = "text/html";
  } else {
    payload = epubBytes;
    mime = "application/epub+zip";
  }

  // Upload to Convex storage and record.
  const uploadUrl = await fetchMutation(
    api.bookExports.generateUploadUrl,
    {},
    { token: auth.token }
  );
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mime },
    body: payload,
  });
  if (!upload.ok) return new Response("Upload failed", { status: 502 });
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };

  await fetchMutation(
    api.bookExports.record,
    {
      bookId,
      format: finalFormat,
      storageId,
      sizeBytes: payload.byteLength,
    },
    { token: auth.token }
  );
  return Response.json({ storageId, sizeBytes: payload.byteLength, mime });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book";
}

function printableHtml(title: string, author: string, chapters: EpubChapter[]): string {
  const escaped = (s: string) =>
    s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escaped(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 2em auto; padding: 0 1em; }
  h1 { page-break-before: always; }
  h1:first-of-type { page-break-before: auto; }
  p { line-height: 1.6; text-indent: 1.5em; margin: 0 0 0.5em; }
  .titlepage { text-align: center; margin: 4em 0; page-break-after: always; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <div class="titlepage"><h1 style="page-break-before:auto">${escaped(title)}</h1><p>${escaped(author)}</p></div>
  ${chapters
    .map(
      (c) =>
        `<h1>${escaped(c.title)}</h1>${c.paragraphs.map((p) => `<p>${escaped(p)}</p>`).join("")}`
    )
    .join("")}
</body></html>`;
}
