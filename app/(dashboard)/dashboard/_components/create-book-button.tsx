"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateBookButton() {
  const create = useMutation(api.books.create);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bookType, setBookType] = useState<"fiction" | "non-fiction">("fiction");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({ title, bookType });
      router.push(`/projects/${id}/idea`);
    } catch (err) {
      const data = err instanceof Error ? err.message : "Failed";
      setError(data);
      setBusy(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New book</Button>;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2 rounded-md border bg-background p-3 shadow-sm"
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-title">Title</Label>
        <Input
          id="new-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          className="w-56"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-type">Type</Label>
        <select
          id="new-type"
          value={bookType}
          onChange={(e) => setBookType(e.target.value as "fiction" | "non-fiction")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="fiction">Fiction</option>
          <option value="non-fiction">Non-fiction</option>
        </select>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "..." : "Create"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setTitle("");
          setError(null);
        }}
      >
        Cancel
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
