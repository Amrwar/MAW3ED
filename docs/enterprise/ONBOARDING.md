# Enterprise onboarding

How a new organization goes from nothing to live — no code change, no deployment. Every step
below is a product screen (or the API behind it); `scripts/qa-phase28.mjs` runs them all for
two organizations.

## 1. Registration (the organization)

1. Someone with a verified email account registers the organization: `/org-admin` →
   Register (name, kind: mall, compound, business group, restaurant/clinic group, franchise,
   commercial building, other). Limited to 5 a day per account.
2. It is created **PENDING** and private.

## 2. Verification and approval (the platform)

3. A platform administrator reviews it (`/admin` → organizations): identity of the operator,
   the right to represent the organization, and its public information. Approve, reject or
   suspend with a written reason (audited). There is no document upload in the product; the
   review is done out of band and recorded in the reason/notes.
4. Approval makes it **APPROVED**; the owner can then publish.

## 3. Profile and branding (the organization)

5. Console → Organization details: names (Arabic/English), description, logo, cover,
   contacts, city, website, **brand colour** (accent on its pages, `#RRGGBB`).
6. Publish: the directory goes live at `/groups/<slug>`.

## 4. Members and roles

7. Console → Members: add administrators (ORGANIZATION_ADMIN). Owners only. Review: the
   permission matrix (`PERMISSION_MATRIX.md`).

## 5. Businesses

8. Console → Businesses: invite by the business's slug, choosing the relationship:
   - **HOSTED** — a tenant listed in the directory; no access to its data.
   - **OWNED** — a brand the organization owns (at most one owner per business).
   - **MANAGED** — a business it operates on the owner's behalf.
   For OWNED/MANAGED, ask for scopes (reservations, customers, services, staff, resources,
   schedules, profile, reports, finance); optionally one branch only.
9. The business owner accepts (granting all, some or none of the scopes) or declines in their
   dashboard. New businesses can be invited by email and onboard straight into the
   organization.

## 6. Venues (where applicable)

10. The platform creates the venue under the organization (`/admin/venues`), then the venue
    manager sets zones, gates, hours and the visitor policy.
11. Visitor access (optional): the platform chooses the venue's **approved** access provider
    and site reference, and stores the venue's own credential (Admin → venue → Venue
    credential). The venue manager switches visitor passes on.

## 7. Contract and integrations

12. The platform records the agreement: Admin → organization → **Contract** (reference to
    the signed agreement, start/end, API keys, webhooks, requests per minute). **No prices
    are entered**: commercial terms stay in the signed contract.
13. The owner creates API keys and webhook endpoints: Console → **Integrations**; developers
    follow `INTEGRATION_GUIDE.md`.

## 8. Go-live checklist

- [ ] Organization APPROVED and published; directory reviewed in Arabic and English.
- [ ] Every business association accepted by its owner with the intended scopes.
- [ ] Venue access tested on the sandbox; the real provider adapter certified (see
      `RELEASE_READINESS.md` — none is certified today).
- [ ] Contract recorded; keys and webhooks created; a webhook ping verified by the receiver.
- [ ] Monitoring: the organization's integration health shows no failing endpoint.

## Offboarding

End the contract (keys and webhooks stop at once), remove or let businesses leave their
associations, unpublish. Data is not deleted by any of these steps.
