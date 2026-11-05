"use client";

import { ArrowLeft, Languages, MessageCircle, Sparkles } from "lucide-react";
import Logo from "@/components/shared/Logo";
import Link from "@/components/shared/LocaleLink";
import { AuthOptionsProvider } from "@/components/auth/AuthOptions";
import { FacebookMark, InstagramMark } from "@/components/auth/brand-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SocialLinks } from "@/lib/social-links";

/**
 * The split layout: a dark brand panel beside the form.
 *
 * The panel comes first in the document and the grid follows the
 * reading direction, so it sits on the left in English and on the right
 * in Arabic with nothing mirrored by hand. Below 900px it shrinks to a
 * band with the logo and the headline, and the form follows straight
 * after (globals.css, "Sign-in pages").
 *
 * The ticket is an illustration of what the product does, labelled as
 * an example and hidden from screen readers; it is not anybody's
 * booking. No figures are claimed.
 */
export default function AuthShell({
  google,
  social,
  children,
}: {
  google: boolean;
  social: SocialLinks;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const a = t.auth;
  const b = a.brand;
  const hasSocial = Boolean(social.instagram || social.facebook);

  return (
    <AuthOptionsProvider value={{ google }}>
      <div className="auth-split">
        <aside className="auth-brand" aria-label={b.label}>
          <Logo size="md" variant="white" className="auth-brand-logo" />

          <div className="auth-brand-copy">
            <p className="auth-headline">{b.headline}</p>
            <p className="auth-subline">{b.subline}</p>
          </div>

          <div className="auth-ticket" aria-hidden="true">
            <div className="auth-ticket-row">
              <span>{b.ticketLabel}</span>
              <span className="auth-ticket-pill">{b.ticketStatus}</span>
            </div>
            <div className="auth-ticket-when">{b.ticketWhen}</div>
            <div className="auth-ticket-row">
              <span>{b.ticketWhere}</span>
              <span className="auth-ticket-example">{b.ticketExample}</span>
            </div>
          </div>

          <ul className="auth-facts">
            <li>
              <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />
              {b.factWhatsApp}
            </li>
            <li>
              <Languages size={16} strokeWidth={1.8} aria-hidden="true" />
              {b.factLanguages}
            </li>
            <li>
              <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
              {b.factFree}
            </li>
          </ul>
        </aside>

        <div className="auth-pane">
          <div className="auth-topbar">
            <Link href="/" className="auth-back">
              <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" className="rtl:rotate-180" />
              {a.backToHome}
            </Link>
          </div>

          <main id="main" className="auth-main">
            <div className="w-full max-w-[26rem]">{children}</div>
          </main>

          <footer className="auth-foot">
            {hasSocial && (
              <div className="auth-social">
                <span>{a.followUs}</span>
                {social.instagram && (
                  <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label={a.instagram}>
                    <InstagramMark />
                  </a>
                )}
                {social.facebook && (
                  <a href={social.facebook} target="_blank" rel="noopener noreferrer" aria-label={a.facebook}>
                    <FacebookMark />
                  </a>
                )}
              </div>
            )}
            <p className="m-0">{a.copyright}</p>
          </footer>
        </div>
      </div>
    </AuthOptionsProvider>
  );
}
