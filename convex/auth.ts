import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: {
        async sendVerificationRequest({ identifier: email, url }) {
          // Email delivery wired in Phase 1.5 (provider TBD: Resend/Postmark).
          // For now, the reset URL is logged to the Convex dashboard.
          console.log(`[auth] password reset for ${email}: ${url}`);
        },
      },
      verify: {
        async sendVerificationRequest({ identifier: email, url }) {
          console.log(`[auth] email verification for ${email}: ${url}`);
        },
      },
    }),
    Google,
  ],
});
