"use client";

import { useSearchParams } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { authErrorKey } from "@/lib/auth/error-key";

/**
 * Says in words why a sign-in came back with ?error=. The type alone
 * ("OAuthAccountNotLinked") means nothing to the person reading it.
 * Nothing at all without ?error=.
 *
 * NextAuth's own errors always land on /login (its error page, see
 * auth.config.ts), even for a Google sign-in a customer started on
 * /account-login. `customerLink` (set on /login) offers the way back to
 * the customer sign-in, so a customer is not left on the business form.
 */
export default function AuthErrorNotice({ customerLink = false }: { customerLink?: boolean }) {
  const { t } = useLanguage();
  const params = useSearchParams();
  const key = authErrorKey(params.get("error"));
  if (!key) return null;
  const e = t.auth.errors;
  return (
    <Alert tone="danger" title={e.title}>
      {e[key]}
      {customerLink && (
        <>
          {" "}
          <Link href="/account-login" className="font-bold underline">
            {e.customerHint}
          </Link>
        </>
      )}
    </Alert>
  );
}
