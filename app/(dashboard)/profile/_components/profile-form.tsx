"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "penName", label: "Pen name" },
  { key: "location", label: "Location" },
  { key: "website", label: "Website" },
  { key: "twitterHandle", label: "Twitter / X handle" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"] | "bio";

export function ProfileForm() {
  const me = useQuery(api.profiles.me);
  const update = useMutation(api.profiles.updateProfile);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    fullName: "",
    penName: "",
    bio: "",
    location: "",
    website: "",
    twitterHandle: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!me?.profile) return;
    setValues({
      fullName: me.profile.fullName ?? "",
      penName: me.profile.penName ?? "",
      bio: me.profile.bio ?? "",
      location: me.profile.location ?? "",
      website: me.profile.website ?? "",
      twitterHandle: me.profile.twitterHandle ?? "",
    });
  }, [me?.profile]);

  if (me === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (!me?.profile) return <p className="text-muted-foreground">No profile yet.</p>;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update(values);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </div>
      ))}
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          rows={4}
          value={values.bio}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedAt && (
          <span className="text-sm text-muted-foreground">Saved</span>
        )}
      </div>
    </form>
  );
}
