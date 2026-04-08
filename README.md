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

### 2026-04-08 — BookingWidget redesign (new visual style)

**Decision:** Redesigned `src/features/company/BookingWidget.tsx` to match the new UI spec — dark navy/blue gradient header, numbered circular stepper with connecting lines, service cards with icon box + checkmark indicator + price, and a full-width navy "التالي" button.

**Why:** User requested a more polished, app-like booking UI matching a provided design mockup.

**Implementation details:**
- Header uses `linear-gradient(135deg, #1f3c88 → #3b5fc9)` with a `CalendarDays` icon in a translucent rounded box.
- Stepper replaces the old inline progress bar with centered circles and labels below.
- Service cards have a `w-14 h-14` icon box (falls back to first-letter avatar if `service.image` is absent), a corner checkmark badge when selected, and the price in `#1f3c88` bold.
- All `Button` component usages replaced with plain `<button>` elements styled in Tailwind for full design control.
- All logic (slots, validation, submit, reset) is unchanged.

---

### 2026-04-08 — Homepage redesign (premium SaaS brand identity)

**Decision:** Full redesign of the homepage and shared layout components to match a premium modern SaaS brand identity (Stripe/Linear/Calendly style) using a new blue-navy color system.

**Color system update:**
- Primary: `#0F172A` (dark navy) — replaces `#0A0A0A` for hero, navbar, footer, CTA sections
- Accent: `#3B82F6` (blue) — replaces `#E85C3A` (orange) as the single brand accent
- Accent light: `#DBEAFE`, Accent hover: `#2563EB`
- Background: `#F8FAFC`, Border: `#E2E8F0`, Text secondary: `#475569`

**Files changed:**
- `src/app/globals.css` — updated CSS design tokens and button/input/gradient styles
- `src/app/page.tsx` — restructured section order, removed FeaturedBusinesses from home, added FAQ
- `src/components/layout/Navbar.tsx` — clean white navbar with blue active states
- `src/components/layout/Footer.tsx` — dark navy footer with organized columns
- `src/features/home/HeroSection.tsx` — dark navy hero with inline booking widget mockup
- `src/features/home/TrustStats.tsx` — stat numbers + business-type pill strip
- `src/features/home/CategoriesSection.tsx` — premium category grid
- `src/features/home/WhyJoin.tsx` — feature benefit grid with lucide icons
- `src/features/home/HowItWorks.tsx` — tabbed (customers/businesses) step cards
- `src/features/home/DemoSection.tsx` — dark navy section with booking + confirmation UI mockups
- `src/features/home/PricingPreview.tsx` — 3-plan pricing with featured middle card
- `src/features/home/Testimonials.tsx` — hardcoded review cards (no external data dependency)
- `src/features/home/FinalCTA.tsx` — dark navy CTA with blue primary button
- `src/features/home/FAQ.tsx` — **new** accordion FAQ component (uses existing `t.faq` translations)

**Trade-offs:**
- `FeaturedBusinesses` removed from homepage (requires DB query for 6 businesses; page now needs only `getCategories()`).
- Hero section no longer has a search bar (search is in Navbar + `/businesses` page).
- Testimonials are hardcoded static cards; not pulled from DB.

---

### 2026-04-08 — Homepage sections premium redesign (SaaS polish pass)

**Decision:** Upgraded five homepage sections with a second premium polish pass: WhyJoin, CategoriesSection (with FeaturedCards), HowItWorks, SectionDivider system, Navbar UserMenu, and PricingPreview.

**Key design decisions:**

- **WhyJoin**: Dot-grid background with edge fades, blue radial spotlight behind product mockup, inline `onMouseEnter/Leave` shadow transitions on feature cards.
- **CategoriesSection / FeaturedCards**: Booking-specific card design — gradient cover with watermark initial, `-mt-8` avatar overlap, 3 time-slot chips (Clock icon), services count chip, dual CTA (Book Now + View Profile). Provider counts per category via `SLUG_META` map.
- **HowItWorks**: Dark navy `#0B1628` section, floating number circles with triple-ring blue glow, dashed connecting line at `top: 28px` (center of 56px circles), white-on-dark step cards, glass toggle for customers/businesses.
- **SectionDivider**: New reusable `src/components/ui/SectionDivider.tsx` with 4 variants — `curve` (SVG arch path), `glow` (radial ellipse + hairline), `fade`, `line`. SVG path math: `M0,H L1440,H L1440,H/2 C1080,0 360,0 0,H/2 Z`.
- **Navbar UserMenu**: New `src/components/layout/UserMenu.tsx` — `UserAvatar` (blue gradient initials), `NotificationBell` (placeholder), `UserMenu` (dropdown with pointerdown click-outside + Escape handlers, opacity+translateY animation). Mobile: identity card + `MobileMenuItem` list + red logout button.
- **PricingPreview**: Blue radial glow behind featured card, `translateY(-10px)` elevation on featured, gradient badge with glow, gradient icon containers per plan tier, check icons in colored circles, featured CTA uses gradient + glow + brightness hover, trust row (no credit card / 5-min setup / 24/7 support).

**Trade-offs:**
- Inline `onMouseEnter/Leave` used instead of Tailwind hover classes to support multi-layer `boxShadow` transitions not expressible in static Tailwind.
- RTL-safe dropdown uses Tailwind `end-0` (resolves to `right:0` LTR / `left:0` RTL). Scale transform avoided to sidestep `transform-origin` RTL issues.
- Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) don't parse with `/\d/` regex — EGP label intentionally hidden for AR plans since currency appears in the period field ("جنيه / شهر").

---

### 2026-04-09 — Testimonials section premium redesign

**Decision:** Redesigned `src/features/home/Testimonials.tsx` with a trust-focused, SaaS-grade layout.

**Key changes:**
- Background: white base with blue radial glow at top (`rgba(59,130,246,0.055)`) and a bottom fade to `#F8FAFC` blending into the next section.
- Header: eyebrow badge + stronger heading + trust sub-line ("Trusted by businesses across Egypt").
- Trust stats row: 4 pill badges (500+ Businesses, 10,000+ Bookings, 4.9★ Rating, 24/7 Support) with a glowing blue dot.
- Cards: `rounded-3xl`, `onMouseEnter/Leave` shadow/border/lift transitions. Featured middle card elevated `translateY(-6px)` with blue-tinted border and deeper shadow.
- Card anatomy: decorative quote mark (large `"` in Georgia, low opacity), star row, review text, divider, avatar (gradient initials) + name + role + location + verified badge pill.
- Testimonial data enriched: longer review text in both AR and EN, gradient per reviewer, `featured: true` on center card.
- Navigation dots below: middle dot is wider (24px pill), flanking dots are small circles — purely decorative.

**Trade-offs:**
- Testimonials remain hardcoded (no DB query) — same as before.
- `featured` flag in TESTIMONIALS array drives the center-card emphasis; if card order changes, update the flag accordingly.

---

### 2026-04-09 — FAQ section premium redesign

**Decision:** Redesigned `src/features/home/FAQ.tsx` for a premium, SaaS-quality FAQ experience.

**Key changes:**
- Background: `#F8FAFC` with two radial glows (blue at top-center, indigo at bottom-end) for soft depth.
- Header: unified eyebrow badge (blue dot + uppercase tracking), `5xl` heading, improved subtitle.
- Accordion: smooth CSS grid expand/collapse using `grid-rows-[0fr]` → `grid-rows-[1fr]` transition (no JS height calc). Open item gets `border-s-[3px] border-s-[#3B82F6]` (logical property, RTL-safe), blue question text, blue-tinted shadow. Closed items have a hairline shadow and hover border darkening. Answer revealed with a blue→transparent gradient hairline separator.
- Chevron: wrapped in a `w-7 h-7` circle pill — `bg-[#F1F5F9]` when closed, `bg-[#DBEAFE]` + blue when open. Rotates 180° on open.
- Support CTA: `rounded-3xl` card with blue gradient background (`rgba(59,130,246,0.06)`), dot-grid texture overlay, gradient icon container (MessageCircle), subtitle, gradient CTA button with `brightness(1.06)` hover.
- Arrow icon in CTA rotated 180° in RTL mode for correct directionality.

**Trade-offs:**
- `grid-rows-[0fr]/[1fr]` requires Tailwind v3.3+. Confirmed this project uses Tailwind v3+.
- `border-s-[3px]` and `border-s-[#3B82F6]` use arbitrary values + logical properties — supported in Tailwind v3.3+.

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
