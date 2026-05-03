import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  // Phase 1 placeholder. Real dashboard lands in Phase 5.
  const token = await convexAuthNextjsToken();
  void token;
  void fetchQuery;
  return (
    <main className="container mx-auto flex min-h-screen flex-col gap-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </div>
      <p className="text-muted-foreground">
        You're signed in. Book list lands in Phase 5.
      </p>
    </main>
  );
}
