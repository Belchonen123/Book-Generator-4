"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export function BoxedSetTab({ seriesId }: { seriesId: Id<"series"> }) {
  const books = useQuery(api.series.booksInSeries, { seriesId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function compile() {
    setBusy(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch("/api/series/compile-boxed-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { storageId } = (await res.json()) as { storageId: string };
      // Find URL on the first book's exports list (Convex query refresh).
      void storageId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Combines every book in the series into a single EPUB with a synthetic
        title page per book. Output lands in the first book's Export tab as
        format <code className="font-mono">boxed_set</code>.
      </p>
      <Button onClick={compile} disabled={busy || !books || books.length === 0}>
        {busy ? "Compiling…" : "Compile boxed set"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {downloadUrl && (
        <a href={downloadUrl} download className="text-sm underline">
          Download
        </a>
      )}
    </div>
  );
}
