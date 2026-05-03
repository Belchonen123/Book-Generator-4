"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Voice = {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
};

export default function AudioPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const chapters = useQuery(api.chapters.listForBook, { bookId });
  const jobs = useQuery(api.audio.listJobs, { bookId });
  const exports = useQuery(api.audio.listExports, { bookId });
  const enqueue = useMutation(api.audio.enqueue);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [busyJobs, setBusyJobs] = useState<Record<string, boolean>>({});
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audio/voices")
      .then((r) => r.json())
      .then((j) => {
        setVoices(j.voices ?? []);
        if (j.voices?.[0]) setVoiceId(j.voices[0].voice_id);
      })
      .catch(() => {
        /* leave empty */
      });
  }, []);

  const latestByChapter = new Map<string, (typeof jobs extends infer T ? T : never)[number] extends infer U ? U : never>();
  if (jobs) {
    const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);
    for (const j of sorted) {
      if (!latestByChapter.has(j.chapterId)) {
        latestByChapter.set(j.chapterId, j);
      }
    }
  }

  async function generate(chapterId: Id<"chapters">) {
    if (!voiceId) {
      setError("No voice selected");
      return;
    }
    setError(null);
    setBusyJobs((b) => ({ ...b, [chapterId]: true }));
    try {
      const { jobId } = await enqueue({ bookId, chapterId, voiceId });
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyJobs((b) => ({ ...b, [chapterId]: false }));
    }
  }

  async function compile() {
    setCompiling(true);
    setError(null);
    try {
      const res = await fetch("/api/audio/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Voice</p>
          {voices.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Loading voices…
            </span>
          ) : (
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {voices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}
                  {v.category ? ` — ${v.category}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button onClick={compile} disabled={compiling}>
          {compiling ? "Compiling ZIP…" : "Compile audiobook ZIP"}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Per chapter</p>
        <ul className="divide-y rounded-md border">
          {chapters?.map((c) => {
            const job = latestByChapter.get(c._id);
            return (
              <li key={c._id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">
                    {c.order}. {c.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {job
                      ? `${job.status}${job.error ? ` — ${job.error}` : ""}`
                      : "no audio yet"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generate(c._id)}
                  disabled={busyJobs[c._id] || !voiceId || !c.plainText.trim()}
                >
                  {busyJobs[c._id] ? "…" : job?.status === "complete" ? "Regenerate" : "Generate"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">Recent ZIPs</p>
        {exports === undefined ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : exports.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No audiobook ZIPs yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {exports.map((e) => (
              <li
                key={e._id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span>
                  {(e.sizeBytes / 1024 / 1024).toFixed(1)} MB · voice{" "}
                  {e.voiceId} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </span>
                {e.url && (
                  <a
                    href={e.url}
                    download
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
