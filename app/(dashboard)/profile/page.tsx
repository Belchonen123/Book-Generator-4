import { ProfileForm } from "./_components/profile-form";

export default function ProfilePage() {
  return (
    <main className="container mx-auto max-w-2xl py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Author profile</h1>
      <ProfileForm />
    </main>
  );
}
