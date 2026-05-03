"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FindReplace({ bookId }: { bookId: Id<"books"> }) {
  const [needle, setNeedle] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [polishAfter, setPolishAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ chapters: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation(api.findReplace.applyReplace);
  const me = useQuery(api.profiles.me);
  const isPro = me?.profile?.subscriptionTier === "pro";

  const matches = useQuery(
    api.findReplace.preview,
    needle.trim()
      ? { bookId, needle, caseSensitive, wholeWord }
      : "skip"
  );
  const totalMatches = matches?.reduce((sum, m) => sum + m.count, 0) ?? 0;

  async function run() {
    if (!needle.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apply({
        bookId,
        needle,
        replacement,
        caseSensitive,
        wholeWord,
      });
      if (polishAfter && isPro && res.chaptersChanged > 0) {
        const polishRes = await fetch("/api/ai/polish-replacements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterIds: res.changed.map((c) => c.chapterId),
            needle,
            replacement,
          }),
        });
        if (!polishRes.ok) throw new Error(await polishRes.text());
      }
      setResult({ chapters: res.chaptersChanged, total: res.totalReplacements });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">Book-wide find &amp; replace</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Find">
          <Input value={needle} onChange={(e) => setNeedle(e.target.value)} />
        </Field>
        <Field label="Replace with">
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Toggle checked={caseSensitive} onChange={setCaseSensitive} label="Case sensitive" />
        <Toggle checked={wholeWord} onChange={setWholeWord} label="Whole word" />
        <Toggle
          checked={polishAfter}
          onChange={setPolishAfter}
          label={`Polish after with AI${isPro ? "" : " (Pro)"}`}
          disabled={!isPro}
        />
      </div>
      {needle.trim() && matches && (
        <p className="text-sm text-muted-foreground">
          {totalMatches} match{totalMatches === 1 ? "" : "es"} across{" "}
          {matches.length} chapter{matches.length === 1 ? "" : "s"}.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="text-sm text-green-700">
          Replaced {result.total} occurrence{result.total === 1 ? "" : "s"} across{" "}
          {result.chapters} chapter{result.chapters === 1 ? "" : "s"}.
        </p>
      )}
      <Button onClick={run} disabled={busy || !needle.trim() || totalMatches === 0}>
        {busy ? "Replacing…" : "Replace all"}
      </Button>
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

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}
