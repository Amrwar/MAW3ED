# Organization product readiness

Read-only audit of main @ 1db4e39 (2026-11-06). "Deployed" means merged to main, which production deploys from. No organization exists on production, so none of the signed-in org flows has ever run there. They were exercised locally on QA data, including a two-organization isolation run (46/46, docs/release/FINAL_READINESS_REPORT.md).

## Subsystem classification

| Subsystem | Classification | Evidence | Public entry point | Tests |
|---|---|---|---|---|
| Business accounts | Implemented and working | Footer.tsx:33 (`/signup?type=business`), onboarding/page.tsx | Yes | business-access.test.ts, business-type.test.ts |
| OWNED organizations | Implemented but not exposed publicly | schema.prisma:2100-2146, lib/organizations/delegation.ts:101 | No | phase22c.db.test.ts, delegation.test.ts, live-grants.test.ts |
| HOSTED organizations | Implemented but not exposed publicly | schema.prisma:2105, lib/organizations/public.ts:25 | Only through the directory | phase22b/22c.db.test.ts |
| MANAGED organizations | Implemented but not exposed publicly | schema.prisma:2108, delegation.ts:85-90 | No | phase22c/phase24.db.test.ts |
| Membership approval | Implemented and working (never run on production) | api/venues/[id]/memberships/[membershipId], api/business/organizations/[id], lib/venues/memberships.ts | Business side in the dashboard nav; deciding side unlinked | phase22/22b.db.test.ts |
| Delegated permissions | Implemented but not exposed publicly | delegation.ts:40-101 (9 scopes, expiry, suspension), ActingBanner.tsx | Granted from the business dashboard | delegation.test.ts, live-grants.test.ts |
| Organization directories | Implemented but not exposed publicly | app/groups/page.tsx, groups/[slug]/page.tsx, sitemap.ts:155 | Not in header or footer; empty and noindex (0 orgs) | organizations.test.ts, phase22b.db.test.ts |
| Public QR links | Implemented and working | api/organizations/[id]/qr/route.ts, api/business/qr | Business QR in /dashboard/links | source.test.ts (the QR routes themselves are untested) |
| Booking attribution | Implemented and working | api/public/[slug]/bookings/route.ts:358, public.ts:198-209 | Via `?org=` | phase22b.db.test.ts, mobile flow.test.ts |
| Booking QR / check-in | Implemented and working (never run on production) | lib/access/check-in.ts, app/c/[code], /dashboard/check-in | Customer booking page | access.test.ts, phase23.db.test.ts |
| Visitor passes | Blocked by external dependency | lib/access/provider.ts:136 (the sandbox refuses to run on Vercel) | No | phase23.db.test.ts |
| External provider adapters | Blocked by external dependency | provider.ts:152 (`partnerAdapters` empty on purpose; Eterna is a fictional concept) | No | access.test.ts, phase28.db.test.ts |
| Subscriptions | Implemented and working, businesses only | lib/plans.ts, api/webhooks/stripe | /pricing, /dashboard/billing | plans/subscription/stripe tests, webhooks route.db.test.ts |
| Mobile integration | Blocked by external dependency (store accounts) | mobile/app/org/[slug].tsx, mobile/features/booking/flow.ts | Not in any store | mobile flow/places/links tests |
| Marketplace analytics | Implemented and working | lib/analytics/funnel.ts, admin/reports, dashboard/reports/funnel | Admin and dashboard | admin/funnel.test.ts. No unit test for lib/analytics/funnel*.ts |

**Nothing is "implemented but not deployed"**: phases 22 through 28 are merged and their production migrations applied (PHASE_STATUS.md).

## How an organization can onboard today

1. Sign up and confirm an email address.
2. Type `/org-admin`; nothing public links there. Submit the registration form. The org is created PENDING, and registrations are limited to 5 a day.
3. A platform admin approves it by hand at `/admin/venues`. No document is collected.
4. Publish the directory, add admins, and invite businesses as HOSTED, OWNED or MANAGED. For OWNED and MANAGED, the business owner grants the scopes.

**Missing:** a public explanation of the offer, a contact-sales or request-a-demo path, org pricing and billing, a privacy section on organizations, and an org-facing help article.

## Notes (by design, worth a product decision)

- `LISTED_RELATIONS` (public.ts:25) excludes MANAGED. A MANAGED-only business never appears in the org directory, and its `?org=` bookings are not credited to the org.
- An account holding a venue or org role that opens `/onboarding` is redirected to `/org-admin`. Its way out is `/onboarding?create=1`.
- Not verified: whether the org console hides the downloadable QR while the org is PENDING. The `/groups/<slug>` page 404s until approval.

## Readiness verdict

The backend is ready for a **pilot organization operated hands-on by the owner**. It is **not ready for self-serve organization sales**. Before the first real org (Phase 30 entry criteria):

1. A privacy notice section on organizations and delegated access.
2. Terms that cover org relationships (Phase 29).
3. A public org landing page with a contact-sales path.
4. One end-to-end run on production with a fictional org, cleaned up afterwards.
