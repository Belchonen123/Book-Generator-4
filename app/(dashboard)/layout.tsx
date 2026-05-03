import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { EnsureProfile } from "./_components/ensure-profile";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <EnsureProfile />
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <Link href="/dashboard" className="font-semibold">
            Book Generator
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <Link href="/dashboard/series" className="hover:underline">Series</Link>
            <Link href="/profile" className="hover:underline">Profile</Link>
            <Link href="/settings" className="hover:underline">Settings</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
