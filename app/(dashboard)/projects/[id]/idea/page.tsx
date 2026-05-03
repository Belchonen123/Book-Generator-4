"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REFINED_FIELDS = [
  { key: "premise", label: "Premise" },
  { key: "mainCharacter", label: "Main character" },
  { key: "stakes", label: "Stakes" },
  { key: "centralConflict", label: "Central conflict" },
  { key: "readerArc", label: "Reader arc" },
] as const;

type Field = (typeof REFINED_FIELDS)[number]["key"];

export default function IdeaPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });
  const saveBasics = useMutation(api.idea.saveBasics);
  const advance = useMutation(api.idea.advanceToOutlining);
  const router = useRouter();

  const [basics, setBasics] = useState({
    title: "",
    subtitle: "",
    rawIdea: "",
    genre: "",
    tone: "",
  });
  const [refining, setRefining] = useState(false);
  const [regenField, setRegenField] = useState<Field | null>(null);
  const [subtitling, setSubtitling] = useState(false);

  useEffect(() => {
    if (!book) return;
    setBasics({
      title: book.title,
      subtitle: book.subtitle ?? "",
      rawIdea: book.rawIdea ?? "",
      genre: book.genre ?? "",
      tone: book.tone ?? "",
    });
  }, [book]);

  if (book === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (book === null) return <p>Not found</p>;

  async function persistBasics(patch: Partial<typeof basics>) {
    setBasics((b) => ({ ...b, ...patch }));
    await saveBasics({ bookId, ...patch });
  }

  async function refine() {
    if (!basics.rawIdea.trim()) return;
    setRefining(true);
    try {
      const res = await fetch("/api/ai/refine-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          idea: basics.rawIdea,
          genre: basics.genre,
          tone: basics.tone,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } finally {
      setRefining(false);
    }
  }

  async function regenerateField(field: Field) {
    setRegenField(field);
    try {
      await fetch("/api/ai/regenerate-idea-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, field }),
      });
    } finally {
      setRegenField(null);
    }
  }

  async function generateSubtitle() {
    setSubtitling(true);
    try {
      await fetch("/api/ai/generate-subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
    } finally {
      setSubtitling(false);
    }
  }

  const refined = book.refinedIdea ?? {};

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Basics</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input
              value={basics.title}
              onChange={(e) => setBasics((b) => ({ ...b, title: e.target.value }))}
              onBlur={() => persistBasics({ title: basics.title })}
            />
          </Field>
          <Field label="Subtitle">
            <div className="flex gap-2">
              <Input
                value={basics.subtitle}
                onChange={(e) => setBasics((b) => ({ ...b, subtitle: e.target.value }))}
                onBlur={() => persistBasics({ subtitle: basics.subtitle })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={subtitling || !refined.premise}
                onClick={generateSubtitle}
              >
                {subtitling ? "..." : "AI"}
              </Button>
            </div>
          </Field>
          <Field label="Genre">
            <Input
              value={basics.genre}
              onChange={(e) => setBasics((b) => ({ ...b, genre: e.target.value }))}
              onBlur={() => persistBasics({ genre: basics.genre })}
            />
          </Field>
          <Field label="Tone">
            <Input
              value={basics.tone}
              onChange={(e) => setBasics((b) => ({ ...b, tone: e.target.value }))}
              onBlur={() => persistBasics({ tone: basics.tone })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">The seed of your story</h2>
        <textarea
          rows={6}
          value={basics.rawIdea}
          onChange={(e) => setBasics((b) => ({ ...b, rawIdea: e.target.value }))}
          onBlur={() => persistBasics({ rawIdea: basics.rawIdea })}
          placeholder="A few sentences. What is this book about?"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button onClick={refine} disabled={refining || !basics.rawIdea.trim()}>
          {refining ? "Refining…" : refined.premise ? "Re-refine" : "Refine with AI"}
        </Button>
      </section>

      {(refined.premise ||
        refined.mainCharacter ||
        refined.stakes ||
        refined.centralConflict ||
        refined.readerArc) && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Refined</h2>
          <div className="space-y-3">
            {REFINED_FIELDS.map(({ key, label }) => (
              <RefinedRow
                key={key}
                label={label}
                value={refined[key] ?? ""}
                regenerating={regenField === key}
                onRegenerate={() => regenerateField(key)}
              />
            ))}
          </div>
          <Button
            onClick={async () => {
              await advance({ bookId });
              router.push(`/projects/${bookId}/outline`);
            }}
          >
            Continue to outline →
          </Button>
        </section>
      )}
    </div>
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

function RefinedRow({
  label,
  value,
  regenerating,
  onRegenerate,
}: {
  label: string;
  value: string;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? "..." : "Regenerate"}
        </Button>
      </div>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
