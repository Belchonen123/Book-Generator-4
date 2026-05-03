import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { synthesize } from "@/lib/ai/elevenlabs";
import { requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK_CHARS = 4500;

/**
 * Synthesizes one chapter to MP3 and uploads it to Convex storage. The
 * client calls this once per chapter (driving a per-chapter progress bar);
 * batching is intentionally on the client so a stalled chapter doesn't
 * block the rest. Long chapters are chunked, then concatenated as a single
 * MP3 (raw byte concat works for ElevenLabs MP3 frames).
 */
export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;

  const { jobId } = (await req.json()) as { jobId: Id<"audioJobs"> };
  await fetchMutation(api.audio.markRunning, { jobId }, { token: auth.token });

  try {
    const job = await fetchQuery(
      api.audio._getJob,
      { id: jobId },
      { token: auth.token }
    );
    const chapter = await fetchQuery(
      api.chapters.get,
      { id: job.chapterId },
      { token: auth.token }
    );
    if (!chapter.plainText.trim()) {
      throw new Error("Chapter is empty");
    }

    const chunks = chunkText(chapter.plainText, CHUNK_CHARS);
    const buffers: Uint8Array[] = [];
    for (const chunk of chunks) {
      const bytes = await synthesize({ voiceId: job.voiceId, text: chunk });
      buffers.push(new Uint8Array(bytes));
    }
    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
      combined.set(b, offset);
      offset += b.byteLength;
    }

    const uploadUrl = await fetchMutation(
      api.audio.generateUploadUrl,
      {},
      { token: auth.token }
    );
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "audio/mpeg" },
      body: combined,
    });
    if (!upload.ok) throw new Error("Upload failed");
    const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };

    await fetchMutation(
      api.audio.markComplete,
      { jobId, storageId },
      { token: auth.token }
    );
    return Response.json({ jobId, storageId, sizeBytes: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    await fetchMutation(
      api.audio.markFailed,
      { jobId, error: message },
      { token: auth.token }
    );
    return new Response(message, { status: 502 });
  }
}

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > max && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
