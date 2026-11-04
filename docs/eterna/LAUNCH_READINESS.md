# Launch readiness: venue and organization pilot

Phase 24, Part 8. Date: 2026-11-03.

## Readiness, in one table

| Area | Ready? | What is missing |
|---|---|---|
| Organization platform: groups, malls, clinic groups, management companies | **Yes, locally verified**. Phase 24 tests: 144 HTTP, 21 browser, 13 load | A signed-in run on production (needs the owner's go-ahead: it creates public pages) |
| Venue configuration (floors, gates, policy, directory, QR, security desk) | **Yes, locally verified** | A real operator's data and agreement (`PILOT_PLAN.md`) |
| Bookings, check-in QR and reports through organizations | **Yes, locally verified**; check-in also partly verified on production (Phase 23 check, 2026-11-03) | — |
| Visitor passes at real gates | **No.** The module works against the sandbox only | Partner milestone (`PARTNER_INTEGRATION_STATUS.md`) |
| Offline customers | **Yes** | The phone keeps the customer's booking page, which is shown offline with its QR, and "Save QR as image" keeps the code outside the browser (F1, fixed) |
| Operations documentation | **Yes** (this document) | Staff training has not been delivered to anyone yet |
| Monitoring | **Partly** | Sentry and the Vercel logs are in place. No uptime check and no log drain yet (S-03 in `SECURITY_OPERATIONS.md`) |
| Legal | **No** | Processor terms between a business and an organization: `[DECISION]` in `docs/legal/PRIVACY_POLICY_DRAFT.md` (Phase 22, O6) |

**The pilot is not LIVE, and must not be called live,** until all of
these hold:

1. A real operator has authorized it in writing.
2. The privacy decision is made.
3. The configuration has been verified on production with that operator.

## Findings from Phase 24 to act on before or during a pilot

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| F1 | **Fixed 2026-11-03** (was P2) | A customer who reloads their booking page with no signal, as in a mall basement, sees the offline notice, not their QR. The service worker deliberately keeps no copy of pages (`public/sw.js`) | Short term: tell customers in the confirmation to open the booking page before arriving, and train desks to find the booking by name in today's list and mark it arrived. Product option: let the booking page offer "save the code" (an image), or allow the service worker to keep **only** the customer's own booking page. That needs a privacy review, because it would store the page on a possibly shared device |
| F2 | Info | The free plan's monthly allowance makes extra online bookings wait for the owner's confirmation, by design. A busy tenant on the free plan will see bookings held as pending | Tell pilot tenants which plan fits their volume before launch |

Gaps fixed in this phase, rather than recorded: tables and rooms could
not be delegated at all (the new `RESOURCES` scope), and groups had no
combined report across their businesses (the portfolio). See
`docs/phases/PHASE_24_REPORT.md`.

## Venue onboarding (for the operator)

Follow `PILOT_PLAN.md`, "The venue configuration", steps 1–13. Then check:

- [ ] The public page `/groups/<slug>` shows the right names in Arabic and English, the logo and the contact details.
- [ ] Every section heading the operator wants is used by at least one tenant.
- [ ] The QR printed at each entrance opens `/groups/<slug>?src=qr`. Scan a printed copy, not the screen.
- [ ] The visitor policy says what security actually does (window, guests, gates, re-entry).
- [ ] The security desk accounts can sign in. Each one sees only `/venue-admin/<id>/access`.
- [ ] Visitor passes are **off** unless the partner milestone has passed.
- [ ] A test booking at one tenant appears in the mall's metrics as a count, with no name.

## Tenant onboarding (for each business)

1. **The business account.** The owner signs up and completes onboarding:
   services, hours, policies reviewed, email confirmed. Then they publish.
   Only the business's own owner can do this. A mall cannot do it for
   them.
2. **Joining the mall.** Either accept the mall's invitation in
   `/dashboard/organizations`, or ask to join from there. Joining is a
   listing only: the mall never sees the business's customers, bookings,
   payments or settings.
3. **The place in the venue.** In `/dashboard/venue`, ask for a place
   (floor and unit). The mall approves it.
4. **A group or a management company.** The business owner decides what
   to grant, scope by scope: reservations, customers, services, staff,
   tables and rooms, opening hours, profile, reports, finance. Finance is
   for an owning group only. The owner can narrow, withdraw or set an end
   date at any time, and the change applies on the next request.
5. **Clinics** are discreet by default: the venue's security desk will not
   see which clinic a visitor is going to. Settings → Availability changes
   this either way.

## Staff training (for tenant staff, ~20 minutes)

| Topic | What to show |
|---|---|
| Today's bookings | `/dashboard/bookings/today`. Confirm, arrived, in progress, done, no-show, and when each is allowed: arrived up to 30 minutes before the start; done and no-show only after it starts |
| Check-in | `/dashboard/check-in`: scan with the camera (Chrome or Edge; on iPhone and iPad paste or type the code, open issue P23-A4), or open the scanned link. States: valid, too early, expired, cancelled, already checked in. A code from another business always says "not found" |
| When the scanner cannot be used | Find the customer by name in today's list and press "Arrived". This is the documented fallback for a lost phone, no signal (F1) or a broken camera |
| Late customers | Check-in works until 30 minutes after the end; after that the code says expired. Seat them by hand if the business agrees |
| What staff never see | Other businesses' bookings, and the mall's data. A mall's people cannot see this business's customers |
| Operating for a group | A group's manager uses the same dashboard with a banner naming the business and the group. Only the granted areas appear |

## Support escalation

| Level | Who | Handles | Target response |
|---|---|---|---|
| L1 | The tenant's own staff, then the mall's information desk | "Where is my booking", directions, the fallback check-in | At once |
| L2 | Maw3ed support (the owner today) | Account access, a booking in a wrong state, the directory, a tenant who cannot join | Same business day |
| L3 | Engineering | 5xx errors, data inconsistencies, anything in Sentry | Within 4 hours for P1, next business day otherwise |
| Partner | The gate operator's contact (only once the partner milestone exists) | Gate system faults | As agreed in the partner contract |

**P1:** bookings cannot be made or seen; the wrong people see
customer data; payments are taken without a booking.
**P2:** one tenant or one flow is broken. **P3:** cosmetic issues and
questions.

Booking issues: `docs/runbooks/BOOKING_OPERATIONS.md`. Payments and
notifications: `docs/runbooks/PAYMENT_OPERATIONS.md`. Organizations:
`docs/runbooks/ORGANIZATION_OPERATIONS.md`.

## Access incident response

| Situation | First action | Then |
|---|---|---|
| A visitor's pass is refused at a gate, but their booking is valid | Security checks the booking on the desk (`/venue-admin/<id>/access`) and admits by hand per the venue's policy | Note the visitor on the desk (escalate). Engineering checks the pass's events. In the sandbox era no real gate is involved |
| The provider is down (the desk shows the provider's health failing) | Switch to manual admission: the desk list shows who is expected, and when | Requests wait as pending and are issued on recovery (tested, 4.5). Nothing needs to be redone |
| A pass may have leaked (a screenshot shared) | The desk holds that pass with a reason. The customer can replace their check-in code from the booking page | The holder can ask again; a guest is re-added by the holder |
| A tenant leaves the mall | The mall removes the venue place and the directory listing | Their visitors' passes stop at once (tested, 4.12). The tenant's own bookings stand |
| Wrong people can see visitor data | Treat as **P1**. Remove the role (`/admin/venues` → roles) | Follow `SECURITY_OPERATIONS.md` §6 (contain, preserve, assess, notify) |

## Monitoring

What to watch during a pilot:

* **Sentry**, issues on these routes:
  * `/api/public/*/bookings`
  * `/api/business/check-in`
  * `/api/realtime/bookings`
  * `/api/organizations/*`
  * `/api/venues/*`
  * `/api/cron/access`
* **Cron responses.**
  * `/api/cron/access`: `jobs.dead` must stay 0; `health` must be ok.
  * `/api/cron/reminders`: `failed` must stay 0.
  * `/api/cron/notifications`: `dead` must stay 0.
* **Weekly:**
  * `AccessSyncJob` rows in DEAD;
  * `NotificationDelivery` rows in DEAD;
  * the 5xx rate on booking routes;
  * the success metrics in `PILOT_PLAN.md`.
* **Before the pilot, still to set up:**
  * an uptime check on `/api/version`;
  * a Vercel log drain;
  * an alert on cron failures (S-03).

## Rollback

* **Code.** Vercel instant rollback to the previous production
  deployment. See `ORGANIZATION_OPERATIONS.md`, "Rolling the code back".
  Phase 24's only migration is additive: one enum value,
  `DelegationScope.RESOURCES`. The previous code runs unchanged on the
  migrated schema, because it never reads the new value.
* **A grant made with the new scope.** If the code is rolled back, any
  RESOURCES grant stays in the database without effect. Remove it from
  the business's organization page if needed.
* **The pilot itself.** Turn visitor passes off for the venue. Hide the
  organization's page, which keeps all data. As a last resort, suspend the
  organization (`/admin/organizations`). Tenants keep their businesses,
  pages and bookings in every case. Nothing in the organization layer
  owns a business.
