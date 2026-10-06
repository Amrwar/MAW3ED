"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { Mail, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORT_WHATSAPP, whatsappHref } from "@/lib/contact";

/**
 * Contact.
 *
 * Every channel on this page used to be inert text. The email address
 * was a paragraph, not a mailto, so it had to be selected and copied;
 * the WhatsApp card said "تواصل عبر واتساب" over no number and no link
 * at all. The one page whose entire job is to be contacted through
 * could not be.
 *
 * A channel is now only rendered when it has somewhere to go.
 */
export default function ContactPage() {
  const { t } = useLanguage();
  const c = t.contact;

  const email = c.channels[0];
  const whatsapp = c.channels[1];

  const channels = [
    email && {
      key: "email",
      Icon: Mail,
      tone: "bg-[var(--color-jade-soft)] text-[var(--color-jade)]",
      title: email.title,
      value: email.value,
      sub: email.sub,
      href: `mailto:${email.value}`,
      external: false,
    },
    // Only when a number is actually configured.
    SUPPORT_WHATSAPP && whatsapp && {
      key: "whatsapp",
      Icon: MessageCircle,
      tone: "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
      title: whatsapp.title,
      value: whatsapp.value,
      sub: whatsapp.sub,
      href: whatsappHref(SUPPORT_WHATSAPP),
      external: true,
    },
  ].filter(Boolean) as {
    key: string;
    Icon: typeof Mail;
    tone: string;
    title: string;
    value: string;
    sub: string;
    href: string;
    external: boolean;
  }[];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">
        <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] py-14">
          <Container>
            <div className="mx-auto max-w-xl text-center">
              <p className="section-eyebrow mb-2">{c.eyebrow}</p>
              <h1 className="section-title mb-4">{c.title}</h1>
              <p className="section-subtitle mx-auto">{c.subtitle}</p>
            </div>
          </Container>
        </section>

        <section className="section-padding">
          <Container>
            <ul className="m-0 flex list-none flex-wrap justify-center gap-6 p-0">
              {channels.map(({ key, Icon, tone, title, value, sub, href, external }) => (
                <li key={key} className="w-full max-w-[20rem]">
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="card card-hover block p-6 text-center"
                  >
                    <span
                      className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] ${tone}`}
                    >
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="mb-1 block font-bold text-[var(--color-text-primary)]">
                      {title}
                    </span>
                    <span className="mb-1 block text-sm font-medium text-[var(--color-accent)]">
                      {value}
                    </span>
                    <span className="block text-xs text-[var(--color-text-muted)]">{sub}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
