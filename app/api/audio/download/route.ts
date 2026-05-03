import JSZip from "jszip";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const { bookId } = (await req.json()) as { bookId: Id<"books"> };
  const book = await fetchQuery(api.books.get, { id: bookId }, { token: auth.token });
  const [chapters, jobs] = await Promise.all([
    fetchQuery(api.chapters.listForBook, { bookId }, { token: auth.token }),
    fetchQuery(api.audio.listJobs, { bookId }, { token: auth.token }),
  ]);

  const chapterById = new Map(chapters.map((c) => [c._id, c]));
  const completedByChapter = new Map<Id<"chapters">, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (job.status !== "complete" || !job.storageId) continue;
    const prev = completedByChapter.get(job.chapterId);
    if (!prev || prev.completedAt! < job.completedAt!) {
      completedByChapter.set(job.chapterId, job);
    }
  }
  if (completedByChapter.size === 0) {
    return new Response("No completed audio yet", { status: 400 });
  }

  const zip = new JSZip();
  let totalBytes = 0;
  let voiceUsed = "";
  const ordered = [...completedByChapter.values()].sort((a, b) => {
    const ca = chapterById.get(a.chapterId);
    const cb = chapterById.get(b.chapterId);
    return (ca?.order ?? 0) - (cb?.order ?? 0);
  });
  for (const job of ordered) {
    const chapter = chapterById.get(job.chapterId);
    if (!chapter || !job.storageId) continue;
    const url = await fetchQuery(
      api.audio._getStorageUrl,
      { storageId: job.storageId },
      { token: auth.token }
    );
    if (!url) continue;
    const res = await fetch(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    totalBytes += bytes.byteLength;
    voiceUsed = job.voiceId;
    zip.file(
      `${String(chapter.order).padStart(3, "0")}-${slug(chapter.title)}.mp3`,
      bytes
    );
  }

  zip.file(
    "README.txt",
    [
      `Audiobook: ${book.title}`,
      `Voice: ${voiceUsed}`,
      `Chapters: ${ordered.length}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "Files are numbered to match playback order.",
    ].join("\n")
  );

  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  const uploadUrl = await fetchMutation(
    api.audio.generateUploadUrl,
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
    api.audio.recordExport,
    {
      bookId,
      voiceId: voiceUsed,
      storageId,
      sizeBytes: zipBytes.byteLength,
    },
    { token: auth.token }
  );

  return Response.json({
    storageId,
    sizeBytes: zipBytes.byteLength,
    chapters: ordered.length,
    audioBytes: totalBytes,
  });
}

function slug(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    "chapter"
  );
}
