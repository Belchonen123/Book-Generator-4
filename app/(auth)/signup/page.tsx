import Link from "next/link";
import { AuthForm } from "../_components/auth-form";

export default function SignupPage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 py-16">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start writing your book</p>
      </div>
      <AuthForm mode="signUp" />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
