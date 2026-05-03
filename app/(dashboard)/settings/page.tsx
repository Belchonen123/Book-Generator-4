import { PreferencesForm } from "./_components/preferences-form";
import { DeleteAccount } from "./_components/delete-account";

export default function SettingsPage() {
  return (
    <main className="container mx-auto max-w-2xl space-y-10 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscription and prompt customization land in later phases.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Preferences</h2>
        <PreferencesForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-red-600">Danger zone</h2>
        <DeleteAccount />
      </section>
    </main>
  );
}
