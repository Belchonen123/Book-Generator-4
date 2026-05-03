import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Book Generator 4</h1>
      <p className="max-w-md text-center text-muted-foreground">
        AI-assisted book writing — rebuilt on Convex.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
