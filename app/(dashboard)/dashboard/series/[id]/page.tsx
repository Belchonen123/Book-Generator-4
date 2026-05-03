"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["planning", "active", "complete", "abandoned"] as const;

export default function SeriesDetailPage() {
  const params = useParams<{ id: string }>();
  const seriesId = params.id as Id<"series">;
  const router = useRouter();

  const series = useQuery(api.series.get, { id: seriesId });
  const books = useQuery(api.series.booksInSeries, { seriesId });
  const allBooks = useQuery(api.books.list, {});
  const update = useMutation(api.series.update);
  const remove = useMutation(api.series.remove);
  const addBook = useMutation(api.series.addBook);
  const removeBook = useMutation(api.series.removeBook);
  const reorder = useMutation(api.series.reorderBooks);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    tagline: "",
    genre: "",
    plannedBookCount: 0,
    worldNotes: "",
  });

  useEffect(() => {
    if (!series) return;
    setDraft({
      name: series.name,
      description: series.description ?? "",
      tagline: series.tagline ?? "",
      genre: series.genre ?? "",
      plannedBookCount: series.plannedBookCount ?? 0,
      worldNotes: series.worldNotes ?? "",
    });
  }, [series]);

  if (series === undefined || books === undefined || allBooks === undefined) {
    return <p className="container mx-auto py-10 text-muted-foreground">Loading…</p>;
  }
  if (!series) return <p className="container mx-auto py-10">Not found</p>;

  const memberIds = new Set(books.map((b) => b._id));
  const eligibleBooks = allBooks.filter(
    (b) => !b.seriesId && !memberIds.has(b._id)
  );

  async function move(idx: number, delta: number) {
    if (!books) return;
    const next = [...books];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    await reorder({
      seriesId,
      orderedBookIds: next.map((b) => b._id),
    });
  }

  return (
    <main className="container mx-auto flex flex-col gap-8 py-10">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/series" className="text-sm text-muted-foreground hover:underline">
          ← Series
        </Link>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={async () => {
            if (!confirm("Delete this series? Books in it will be unlinked but kept.")) return;
            await remove({ id: seriesId });
            router.push("/dashboard/series");
          }}
        >
          Delete series
        </Button>
      </div>

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{series.name}</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onBlur={() => update({ id: seriesId, name: draft.name })}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={draft.tagline}
              onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
              onBlur={() => update({ id: seriesId, tagline: draft.tagline })}
            />
          </Field>
          <Field label="Genre">
            <Input
              value={draft.genre}
              onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
              onBlur={() => update({ id: seriesId, genre: draft.genre })}
            />
          </Field>
          <Field label="Planned books">
            <Input
              type="number"
              value={draft.plannedBookCount}
              min={1}
              onChange={(e) =>
                setDraft((d) => ({ ...d, plannedBookCount: Number(e.target.value) || 0 }))
              }
              onBlur={() =>
                update({ id: seriesId, plannedBookCount: draft.plannedBookCount })
              }
            />
          </Field>
          <Field label="Status">
            <select
              value={series.status}
              onChange={(e) =>
                update({
                  id: seriesId,
                  status: e.target.value as (typeof STATUSES)[number],
                })
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            onBlur={() => update({ id: seriesId, description: draft.description })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
        <Field label="World notes">
          <textarea
            rows={5}
            value={draft.worldNotes}
            onChange={(e) => setDraft((d) => ({ ...d, worldNotes: e.target.value }))}
            onBlur={() => update({ id: seriesId, worldNotes: draft.worldNotes })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Books</h2>
        {books.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No books in this series yet.
          </p>
        ) : (
          <ol className="divide-y rounded-md border">
            {books.map((b, i) => (
              <li key={b._id} className="flex items-center gap-2 p-3">
                <span className="w-6 text-right text-sm text-muted-foreground">
                  {i + 1}.
                </span>
                <Link
                  href={`/projects/${b._id}`}
                  className="flex-1 text-sm hover:underline"
                >
                  {b.title}
                </Link>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === books.length - 1}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => removeBook({ bookId: b._id })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ol>
        )}

        {eligibleBooks.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Add a book</p>
            <ul className="space-y-1">
              {eligibleBooks.map((b) => (
                <li key={b._id} className="flex items-center justify-between text-sm">
                  <span>{b.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addBook({ seriesId, bookId: b._id })}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
