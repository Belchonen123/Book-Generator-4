"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SeriesIndexPage() {
  const me = useQuery(api.profiles.me);
  const series = useQuery(api.series.list, {});
  const create = useMutation(api.series.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [plannedBookCount, setPlannedBookCount] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const isPro = me?.profile?.subscriptionTier === "pro";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create({
        name,
        genre: genre || undefined,
        plannedBookCount,
      });
      setName("");
      setGenre("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <main className="container mx-auto flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Series</h1>
        {isPro ? (
          <Button onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "New series"}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">
            Series is a Pro feature.
          </span>
        )}
      </div>

      {open && isPro && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-md border p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Genre">
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
            </Field>
            <Field label="Planned books">
              <Input
                type="number"
                value={plannedBookCount}
                min={1}
                onChange={(e) => setPlannedBookCount(Number(e.target.value) || 1)}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={!name.trim()}>
            Create
          </Button>
        </form>
      )}

      {series === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : series.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No series yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {series.map((s) => (
            <li key={s._id}>
              <Link
                href={`/dashboard/series/${s._id}`}
                className="block p-4 hover:bg-muted/50"
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.status}
                  {s.genre ? ` · ${s.genre}` : ""}
                  {s.plannedBookCount ? ` · ${s.plannedBookCount} planned` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
