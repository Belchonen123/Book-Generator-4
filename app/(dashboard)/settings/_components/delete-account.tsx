"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccount() {
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.profiles.deleteAccount);
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({});
      await signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-200 p-4">
      <p className="text-sm text-muted-foreground">
        Permanently delete your account and all associated data. This cannot be
        undone. Type <code className="font-mono">DELETE</code> to confirm.
      </p>
      <Input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        variant="outline"
        className="border-red-300 text-red-600 hover:bg-red-50"
        disabled={confirm !== "DELETE" || busy}
        onClick={onDelete}
      >
        {busy ? "Deleting…" : "Delete my account"}
      </Button>
    </div>
  );
}
