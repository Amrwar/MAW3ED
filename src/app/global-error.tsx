"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last resort: an error in the root layout itself, where no provider,
 * font or stylesheet can be trusted. It brings its own <html> and <body>,
 * says it in both languages, and reports to Sentry (final audit F-35).
 * Without it, Next showed its default unstyled English page.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf9f7", color: "#1c1917" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>حصلت مشكلة عندنا</h1>
            <p dir="ltr" style={{ fontSize: 16, margin: "0 0 20px", color: "#57534e" }}>
              Something went wrong on our side.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ padding: "10px 20px", fontSize: 15, borderRadius: 8, border: "1px solid #d6d3d1", background: "#fff", cursor: "pointer" }}
            >
              جرّب تاني · Try again
            </button>
            {/* A plain link: the router may be what failed, so a full page load is the point. */}
            <p style={{ marginTop: 16 }}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ color: "#0f766e" }}>
                الصفحة الرئيسية · Home
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
