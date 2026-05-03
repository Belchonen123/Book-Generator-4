"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ExportPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });
  const exports = useQuery(api.bookExports.list, { bookId });
  const removeExport = useMutation(api.bookExports.remove);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");

  useEffect(() => {
    if (book?.metadata?.keywords) {
      setKeywords(book.metadata.keywords.join(", "));
    }
  }, [book?.metadata?.keywords]);

  async function ai(slug: string, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/ai/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportFormat(format: "epub" | "pdf" | "kdp") {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!book) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Marketing copy</h2>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Back-cover blurb</Label>
            <Button size="sm" variant="outline" onClick={() => ai("generate-back-cover", "back")}>
              {busy === "back" ? "…" : "Generate"}
            </Button>
          </div>
          <textarea
            rows={6}
            readOnly
            value={book.metadata?.backCover ?? ""}
            className="w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>About the author</Label>
            <Button size="sm" variant="outline" onClick={() => ai("generate-about-author", "author")}>
              {busy === "author" ? "…" : "Generate"}
            </Button>
          </div>
          <textarea
            rows={4}
            readOnly
            value={book.metadata?.aboutAuthor ?? ""}
            className="w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>KDP metadata (keywords + category)</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => ai("generate-book-metadata", "meta")}
            >
              {busy === "meta" ? "…" : "Generate"}
            </Button>
          </div>
          <Input value={keywords} readOnly placeholder="Keywords…" />
          <Input value={book.metadata?.category ?? ""} readOnly placeholder="Category…" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Compile</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportFormat("epub")} disabled={busy !== null}>
            {busy === "epub" ? "Building…" : "EPUB"}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportFormat("pdf")}
            disabled={busy !== null}
          >
            {busy === "pdf" ? "Building…" : "PDF (printable HTML)"}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportFormat("kdp")}
            disabled={busy !== null}
          >
            {busy === "kdp" ? "Building…" : "KDP pack"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <p className="mb-2 text-sm font-medium">Recent exports</p>
          {exports === undefined ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : exports.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No exports yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {exports.map((e) => (
                <li
                  key={e._id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>
                    <span className="font-mono uppercase">{e.format}</span>
                    {" · "}
                    {(e.sizeBytes / 1024).toFixed(0)} KB
                    {" · "}
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                  <span className="flex gap-1">
                    {e.url && (
                      <a
                        href={e.url}
                        download
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      >
                        Download
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => removeExport({ id: e._id })}
                    >
                      Delete
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
