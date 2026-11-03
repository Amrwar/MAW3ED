# Venue pilot plan (Eterna-style mall)

Phase 24, 2026-11-03.

## What "Eterna" means in this programme

Eterna is the **concept** of the kind of destination Maw3ed serves: a
mall with independent tenants, a gated access system and a security
desk. On 2026-11-03 the owner said Eterna is a concept only: *"I don't
want you to do the Eterna data, it is just the concept."* So:

* No real Eterna or Emaar data was used, imported or configured anywhere.
  That covers names, logos, tenants, gates, people and contracts.
* Every test organization is **clearly labelled fictional test data**,
  for example "Nile Gate Mall (fictional test data)" or
  "مول بوابة النيل (بيانات تجريبية)".
* Nothing was created on production. Every organization in this phase
  was built on the QA database and removed afterwards.

A real pilot needs a real operator who has agreed to it. This plan says
what the platform needs from that operator, and how the pilot would run.

## The venue configuration (how a real mall is set up)

These steps were exercised end to end with the fictional mall by
`scripts/qa-phase24.mjs` (parts B and 2).

| # | Step | Who | Where |
|---|---|---|---|
| 1 | The operator's account registers the organization (kind `MALL`) | Operator | `/org-admin` → register |
| 2 | Review and approval | Maw3ed platform admin | `/admin/organizations` |
| 3 | Profile (names ar/en, description, logo, cover, contact), then publish the page | Operator | `/org-admin/<id>` |
| 4 | The venue (the physical place) is created under the organization, then activated and published | Platform admin | `POST /api/admin/venues`, `PATCH /api/admin/venues/<id>` |
| 5 | Floors and zones (e.g. ground floor, food court) | Operator | Venue console `/venue-admin/<id>` |
| 6 | Gates (e.g. north gate, car-park gate), each with its gate-system code | Operator | Venue console |
| 7 | Visitor policy: who may receive a pass, how long before and after a booking, guest limit, allowed gates, re-entry, cut-offs, instructions ar/en, escalation contact | Operator | Venue console → policy |
| 8 | Access provider and site reference. **Sandbox only today** (see `PARTNER_INTEGRATION_STATUS.md`) | Platform admin | `PUT /api/venues/<id>/access` |
| 9 | Visitor passes switched on | Operator | Venue console → access |
| 10 | Security-desk accounts (role `VENUE_SECURITY`) | Platform admin, at the operator's request | `/admin/venues` → roles |
| 11 | Tenants are invited (`HOSTED`), or ask to join, and are sorted into sections ("المطاعم", "العيادات", …). The business accepts; nothing operational is ever shared | Operator ↔ each tenant | `/org-admin/<id>`, `/dashboard/organizations` |
| 12 | Each tenant asks for its place in the venue (floor, unit); the venue approves | Tenant → operator | `/dashboard/venue`, venue console |
| 13 | The directory URL and QR are printed and placed (entrances, lifts, food court) | Operator | `/org-admin/<id>` → link and QR |

Clinics, dentists and labs are **discreet** by default. The security
desk sees their visitors but not which clinic they are going to.

## What a real operator must provide

1. A signed pilot agreement. It covers data processing between Maw3ed and
   the operator, and the open `[DECISION]` in
   `docs/legal/PRIVACY_POLICY_DRAFT.md` (Phase 22, O6).
2. The organization's legal name, bilingual display names, logo and
   contact person.
3. The floors, zones and gates as the operator names them.
4. The visitor policy the operator's security team wants (step 7).
5. The tenants taking part in the pilot. Each tenant joins on its own
   account and accepts the invitation itself. The operator cannot add a
   tenant on the tenant's behalf.
6. For passes at real gates: the gate provider's interface documentation,
   test credentials and a test gate. This is a separate milestone; see
   `PARTNER_INTEGRATION_STATUS.md`. Until then the pilot runs **without
   gate passes**: the directory, bookings, check-in QR and reports all
   work without them.

## Target traffic (baseline for the load tests)

One mall, 40 participating tenants, a busy weekend day. These are planning
assumptions for a first pilot, not measurements of any real mall:

| Flow | Assumed peak | Load-test target (with headroom) |
|---|---|---|
| Directory views (QR scans, links) | 2,000 an hour (~0.6/s; bursts of 5/s) | 20 concurrent visitors, continuously |
| Directory search and filtering | 500 an hour | 10 concurrent |
| Availability lookups | 3,000 an hour (~1/s; bursts of 10/s) | 20 concurrent |
| Bookings | 300 an hour; popular times contested | 30 customers racing for one time, 10 times |
| Check-in scans | 40 desks, at most one scan a second each | 20 desks × 1 scan a second |
| Visitor pass requests | 100 an hour | 60 requests issued in one queue run |
| Gate events (callbacks) | 300 an hour, each possibly delivered several times | 20 concurrent, every event delivered 3× |
| Organization dashboards | A handful of managers | 5 concurrent, over 20,000 past bookings |

Pass criteria, results, and what these numbers do **not** prove are in
`ORGANIZATION_TEST_RESULTS.md` (Part 5).

## Pilot phases

| Stage | What happens | Exit criterion |
|---|---|---|
| 0. Agreement | Operator agreement, privacy decision, tenant list | Signed; the O6 privacy decision is made |
| 1. Configuration | Steps 1–13 on production with the operator's real data; staff training | The operator's own staff complete the onboarding checklist (`LAUNCH_READINESS.md`) |
| 2. Soft launch | 5–10 tenants; the directory QR at one entrance; no gate passes | Two weeks with no P1 incident; the success metrics below are measured |
| 3. Full directory | All participating tenants; QR at every entrance | Four weeks; metrics at target |
| 4. Gate passes (optional) | Only after the partner milestone passes its acceptance tests on a test gate | Partner sign-off (`PARTNER_INTEGRATION_STATUS.md`) |

**The pilot is not LIVE until** a real operator has authorized it and
stage 1 has been verified on production with that operator. Nothing in
this phase does either.

## Success metrics

| Metric | How it is measured | Target for the pilot |
|---|---|---|
| Directory reach | Organization page visits, by channel (QR, direct) — console metrics | Growing week on week; QR ≥ 30% of visits |
| Conversion | Bookings attributed to the mall's page ÷ page visits | ≥ 3% |
| Tenant activation | Tenants with ≥ 1 booking from the directory in the period | ≥ 60% of participating tenants |
| Show-up | Completed ÷ (completed + no-shows), per tenant (each tenant's report) | ≥ 85% |
| Check-in adoption | Bookings checked in by QR ÷ arrived bookings | ≥ 50% by week 4 |
| Reliability | 5xx rate on booking and directory routes (Sentry, Vercel) | < 0.1%; no P1 incident |
| Support load | Tickets per 100 bookings | < 2 |
| Privacy | Incidents where a venue saw tenant customer data | 0 (any one is a P1) |
