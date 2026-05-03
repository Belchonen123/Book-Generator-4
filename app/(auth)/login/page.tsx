import Link from "next/link";
import { AuthForm } from "../_components/auth-form";

export default function LoginPage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 py-16">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your account</p>
      </div>
      <AuthForm mode="signIn" />
      <div className="space-y-2 text-center text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:underline">
          Forgot password?
        </Link>
        <p className="text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
