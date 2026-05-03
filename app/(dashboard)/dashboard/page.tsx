import { OnboardingPrompt } from "./_components/onboarding-prompt";
import { BookList } from "./_components/book-list";
import { CreateBookButton } from "./_components/create-book-button";

export default function DashboardPage() {
  return (
    <main className="container mx-auto flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your books</h1>
        <CreateBookButton />
      </div>
      <OnboardingPrompt />
      <BookList />
    </main>
  );
}
