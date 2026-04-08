# Maw3ed — موعد

Booking platform for Egyptian businesses (clinics, salons, gyms, spas, consulting, etc.)

---

## Decision Log

### 2026-04-08 — Bilingual dashboard (AR/EN)

**Decision:** Extended the existing `src/lib/i18n.ts` translation system to cover the entire dashboard instead of using a separate i18n library.

**Why:** The public site already used a custom `useLanguage()` hook with a `maw3ed-lang` cookie. Reusing the same system keeps the codebase consistent and avoids adding a dependency.

**Trade-offs:**
- Server components that need translated text must either read the cookie manually via `next/headers` or be converted to client components.
- For the dashboard home page (`src/app/dashboard/page.tsx`), a client wrapper (`DashboardHomeClient.tsx`) was created to keep DB queries server-side while rendering translated UI client-side.

---

### 2026-04-08 — Capacitor for Android & iOS

**Decision:** Used Capacitor to wrap the live Vercel deployment (`https://maw-3-ed.vercel.app`) in a native WebView shell instead of doing a React Native rewrite.

**Why:** The app has server-side features (NextAuth, Prisma, API routes) that cannot be statically exported. Pointing Capacitor at the live URL means no code duplication and automatic updates with every Vercel deploy — no App Store release required for content changes.

**Trade-offs:**
- Feels like a website rather than a fully native app (scrolling, animations).
- App Store rejection risk is slightly higher for pure webview apps.
- iOS build requires a Mac with Xcode — cannot be done on Windows.

**Config:** `capacitor.config.ts` — App ID: `com.maw3ed.app`, App name: `موعد`.

---

### 2026-04-08 — Security: removed exposed database credentials

**Decision:** Removed a local tooling settings file from git tracking and ignored the directory it lived in.

**Why:** The file contained raw PostgreSQL credentials (Neon `DATABASE_URL`) that were committed to the public GitHub repo and flagged as Critical by GitGuardian.

**Action taken:** Rotate the Neon database password and update `.env` and Vercel environment variables. The file is removed going forward but remains in git history — rotating the credentials makes the historical exposure harmless.

---

### 2026-04-08 — Consulting category with custom SVG icon

**Decision:** Added a consulting specialty category using a custom SVG icon (`/public/consulting-icon.svg`) instead of an emoji.

**Why:** The user wanted a professional branded icon for consulting rather than a generic emoji.

**Implementation:** Added an optional `iconSvg` field to the `Category` type. `CategoriesSection` renders `<Image>` when `iconSvg` is present, falling back to the emoji `icon` field for all other categories. This keeps existing categories unchanged.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
