"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AssistPanel({
  bookId,
  chapterId,
  onInsert,
  busy,
  setBusy,
}: {
  bookId: Id<"books">;
  chapterId: Id<"chapters">;
  onInsert: (text: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  void bookId;
  const [beat, setBeat] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function chapterAssist(op: "expand" | "tighten" | "tone", detail = "") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/chapter-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, op, detail }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Editor will refresh via the chapter query.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function sceneBeat() {
    if (!beat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/scene-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, beat }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { text } = await res.json();
      onInsert(`\n\n${text}\n\n`);
      setBeat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function voiceMemo(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("audio", file);
      fd.set("chapterId", chapterId);
      const res = await fetch("/api/ai/voice-to-chapter", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Whole chapter
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => chapterAssist("expand")}>
            Expand
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => chapterAssist("tighten")}>
            Tighten
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => chapterAssist("tone", "Match the voice examples on the Style tab")}
          >
            Match tone
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Scene beat → prose
        </p>
        <div className="flex gap-2">
          <Input
            value={beat}
            onChange={(e) => setBeat(e.target.value)}
            placeholder="e.g. Mara confronts the captain on the bridge"
          />
          <Button size="sm" disabled={busy || !beat.trim()} onClick={sceneBeat}>
            Insert
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Voice memo → chapter
        </p>
        <Input
          type="file"
          accept="audio/*"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) voiceMemo(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
