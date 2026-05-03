"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CoverPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const active = useQuery(api.covers.getActive, { bookId });
  const variants = useQuery(api.covers.listVariants, { bookId });
  const generateUploadUrl = useMutation(api.covers.generateUploadUrl);
  const recordVariant = useMutation(api.covers.recordVariant);
  const setActive = useMutation(api.covers.setActive);
  const removeVariant = useMutation(api.covers.removeVariant);

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, prompt: prompt || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await recordVariant({
        bookId,
        storageId,
        source: "upload",
        setActive: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <div className="space-y-4">
        <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted">
          {active?.url ? (
            <img
              src={active.url}
              alt="Active cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No cover yet
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cover-prompt">Optional prompt</Label>
          <textarea
            id="cover-prompt"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Leave blank to derive from book metadata."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={generate} disabled={generating} className="w-full">
          {generating ? "Generating…" : "Generate with AI"}
        </Button>
        <div className="space-y-1.5">
          <Label htmlFor="cover-upload">Or upload your own</Label>
          <Input
            id="cover-upload"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Variants</p>
        {variants === undefined ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : variants.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No variants yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {variants.map((vrec) => (
              <div key={vrec._id} className="space-y-2">
                <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted">
                  {vrec.url && (
                    <img
                      src={vrec.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActive({ variantId: vrec._id })}
                    disabled={vrec.storageId === active?.storageId}
                  >
                    {vrec.storageId === active?.storageId ? "Active" : "Use"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => removeVariant({ variantId: vrec._id })}
                  >
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {vrec.source === "ai" ? "AI" : "Upload"} ·{" "}
                  {new Date(vrec.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
