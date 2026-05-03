import { OnboardingPrompt } from "./_components/onboarding-prompt";

export default function DashboardPage() {
  return (
    <main className="container mx-auto flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <OnboardingPrompt />
      <p className="text-muted-foreground">
        Book list lands in Phase 5.
      </p>
    </main>
  );
}
