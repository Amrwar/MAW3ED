"use client";

import { useSearchParams } from "next/navigation";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { authErrorKey } from "@/lib/auth/error-key";

/**
 * Says in words why a sign-in came back. NextAuth returns to its error
 * page (/login, auth.config.ts) with ?error=<type>, and the type alone
 * ("OAuthAccountNotLinked") means nothing to the person reading it.
 * Nothing at all without ?error=.
 */
export default function AuthErrorNotice() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const key = authErrorKey(params.get("error"));
  if (!key) return null;
  const e = t.auth.errors;
  return (
    <Alert tone="danger" title={e.title}>
      {e[key]}
    </Alert>
  );
}
