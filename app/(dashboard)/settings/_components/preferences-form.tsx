"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function PreferencesForm() {
  const me = useQuery(api.profiles.me);
  const update = useMutation(api.profiles.updatePreferences);
  if (!me?.profile) return <p className="text-muted-foreground">Loading…</p>;

  const prefs = me.profile.preferences;

  return (
    <div className="space-y-3 text-sm">
      <Toggle
        label="Ask before regenerating chapters when I edit the outline"
        checked={prefs.askRewriteOnOutlineEdit ?? true}
        onChange={(v) => update({ askRewriteOnOutlineEdit: v })}
      />
      <Toggle
        label="Auto-run slop scan on generated chapters"
        checked={prefs.autoSlopScanGeneratedChapters ?? false}
        onChange={(v) => update({ autoSlopScanGeneratedChapters: v })}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}
