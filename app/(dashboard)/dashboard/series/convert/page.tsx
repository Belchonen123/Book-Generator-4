"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConvertPage() {
  const me = useQuery(api.profiles.me);
  const books = useQuery(api.books.list, {});
  const convert = useMutation(api.seriesConvert.convertStandalone);
  const router = useRouter();
  const [bookId, setBookId] = useState<Id<"books"> | "">("");
  const [seriesName, setSeriesName] = useState("");
  const [planned, setPlanned] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isPro = me?.profile?.subscriptionTier === "pro";

  if (!isPro) {
    return (
      <main className="container mx-auto max-w-xl py-10">
        <h1 className="text-2xl font-semibold">Convert to series</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Series conversion is a Pro feature.
        </p>
      </main>
    );
  }

  const eligible = books?.filter((b) => !b.seriesId) ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId) return;
    setBusy(true);
    setError(null);
    try {
      const seriesId = await convert({
        bookId: bookId as Id<"books">,
        seriesName,
        plannedBookCount: planned,
      });
      router.push(`/dashboard/series/${seriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <main className="container mx-auto max-w-xl py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Convert standalone book to series
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The selected book becomes book #1 in a new series. Other fields
        (genre, world notes, planned count) seed the series record.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="book">Book</Label>
          <select
            id="book"
            value={bookId}
            onChange={(e) => setBookId(e.target.value as Id<"books">)}
            required
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Choose a book…</option>
            {eligible.map((b) => (
              <option key={b._id} value={b._id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series-name">Series name</Label>
          <Input
            id="series-name"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="planned">Planned books</Label>
          <Input
            id="planned"
            type="number"
            min={1}
            value={planned}
            onChange={(e) => setPlanned(Number(e.target.value) || 1)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy || !bookId || !seriesName.trim()}>
          {busy ? "Converting…" : "Convert"}
        </Button>
      </form>
    </main>
  );
}
