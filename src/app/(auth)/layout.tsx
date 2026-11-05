import { googleEnabled } from "@/lib/auth/google";
import { socialLinks } from "@/lib/social-links";
import AuthShell from "./_components/AuthShell";

/**
 * Every sign-in page: customer phone sign-in, business sign-in and
 * sign-up, forgot and reset password.
 *
 * A server component only to read the environment, which decides
 * whether Google is offered and which "Follow us" links exist; the
 * pages and the shell are client components and cannot.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell google={googleEnabled()} social={socialLinks()}>
      {children}
    </AuthShell>
  );
}
