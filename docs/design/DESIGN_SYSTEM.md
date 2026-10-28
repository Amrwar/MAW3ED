# Design system: "Nasma"

Audited in Phase 18 (2026-10-28). This records what the system is, where
it lives, and the rules that keep it one system. The source of truth is
`src/app/globals.css` and `src/components/ui/`.

## Where it lives

| Layer | Location | Notes |
|---|---|---|
| Tokens | `src/app/globals.css` → `@theme inline` | 56 colours, 4 font stacks, 7 radii, 8 shadows, 11 spacing values. Every colour in the app is a token: a grep for raw Tailwind colour classes (`bg-red-500` and the like) across `src` finds **none**; the only hex values outside `globals.css` are in email templates (which cannot use CSS variables), the Cloudinary/QR helpers and the Avatar palette |
| Utility classes | `globals.css` | `.btn` (+ `-primary`, `-accent`, `-night`, `-outline`, `-jade-outline`, `-ghost`, `-danger`, `-sm`, `-lg`, `-pill`), `.card`, `.input`/`.select`/`.textarea`, `.field-label`/`-hint`/`-error`, `.badge-*`, `.chip-*`, `.section-eyebrow`/`-title`/`-subtitle`, `.container-app`, `.num` (LTR digits), `.only-ar`/`.only-en` (Phase 18) |
| Primitives | `src/components/ui/` (import from `@/components/ui`) | Container, Num; Button, Input, Select, Textarea, TimeSlot; Card, Modal, Dropdown; Tabs, Pagination; Table, Badge, Chip, StatusBadge, Avatar, SectionHeading; Alert, Toast, Skeleton, EmptyState |
| Shared pieces | `src/components/shared/` | BusinessCard, Breadcrumbs, CategoryChip, Stars, StarRating→removed, PageHero, Logo, LocaleLink, BillingCycleToggle, ImageUpload, LocationField |
| Layout | `src/components/layout/` | Navbar, Footer, DashboardSidebar, UserMenu |

## Foundations

- **Colour.** Warm off-white ground (`--color-ground`), white surfaces,
  deep green-black ink, one brand accent (jade). Status colours are
  independent of the brand hue. Text tokens are contrast-checked:
  `--color-subtle` is 4.5:1 on white and is the floor for live text;
  `--color-faint` is for disabled states and placeholders only.
- **Type.** Almarai for Arabic (the default `--font-sans`), Instrument
  Sans for Latin, Newsreader for display. Scale through `.section-title`
  (`clamp`-based), `.section-subtitle`, `.section-eyebrow`, and Tailwind
  sizes for everything else. No component sets its own `font-family`
  (Phase 18 removed the last two: the booking widget and the error page
  pointed at an undefined `--font-cairo`).
- **Radii.** xs 6px chips · sm 8px small controls · md 13px buttons and
  inputs · lg 18px cards · xl 24px panels · 2xl 28px hero blocks · full.
- **Elevation.** `--shadow-raised` (cards), `--shadow-float` (panels,
  the booking widget), `--shadow-sheet` (bottom sheets), `--shadow-jade`
  (primary CTA).
- **Spacing.** `--spacing-section` for vertical rhythm between sections;
  `.container-app` for the page gutter (16px at phone width).
- **Direction.** The document's `dir` follows the language. Components
  use logical properties (`start`/`end`, `ps-`/`pe-`) and flip chevrons
  by direction. Digits and identifiers that must read LTR (phones,
  references, prices in tables) use `.num` or `dir="ltr"`.
- **Focus.** A global `:focus-visible` ring; controls that hide their own
  outline (search fields inside a bordered wrapper) carry the ring on
  the wrapper through `focus-within`. Checked by `scripts/qa-phase18.mjs`.

## Component rules

- **Buttons:** one `Button` primitive plus the `.btn` classes for anchors.
  Hierarchy on a screen: at most one `primary` per view, `outline`
  for secondary, `ghost` for tertiary, `danger` only for destructive
  actions behind a confirmation.
- **Forms:** `Input`/`Select`/`Textarea` with `label`, `hint`, `error`.
  Errors are inline, under the field, with `aria-invalid` and
  `aria-describedby`; the booking widget follows the same pattern by
  hand (checked end to end in `scripts/qa-booking-e2e.mjs`).
- **Modals:** `Modal` only. It traps focus, closes on Escape, restores
  focus, locks scroll, and labels itself.
- **Status:** `StatusBadge` from `components/ui` for booking states;
  colour and lightness both change so states are told apart without
  hue. The second `StatusBadge` under `features/dashboard/bookings` was
  unused and is gone (Phase 18).
- **Pagination:** three pieces, each for a different job, kept on
  purpose: `Pagination` (interactive tables), `LinkPager` (server-
  rendered previous/next links), `PaginationBar` (numbered real links
  for the marketplace, so crawlers and middle-click work).
- **Empty, loading, error:** `EmptyState` with a verb in the title and
  the one action that fixes it; `Skeleton` only on routes that are slow
  enough to need it (`businesses`, `dashboard`); `ErrorPage` for
  route-level errors. Loading fallbacks are language-aware through
  `.only-ar`/`.only-en`.
- **Icons:** `lucide-react` only, 14–22px, `aria-hidden` unless the icon
  is the only content, in which case the control has an `aria-label`.
- **Imagery:** Cloudinary with `f_auto,q_auto` and width transforms
  (`src/lib/cdn-image.ts`); category covers are generated gradients
  with a masked glyph (`src/lib/category-cover.ts`), never stock photos
  pretending to be the business.

## Known debt

- `src/components/shared/ErrorPage.tsx` (750 lines) and
  `DashboardHeader.tsx` (873 lines) carry a lot of inline layout that
  could move onto the primitives.
- `.num` is a class rather than a component; `Num` exists in the kit
  and new code should prefer it.
- Legacy colour aliases (`--color-brand`, `--color-text-muted`, …)
  remain as references to the new tokens for older components; new code
  uses the new names.
