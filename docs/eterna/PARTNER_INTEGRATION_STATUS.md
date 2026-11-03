# Partner integration status (gate access)

Phase 24, Part 7. Date: 2026-11-03.

## Verdict: BLOCKED (external)

There is no live gate integration. None is claimed anywhere in the
product, its screens or these documents.

| Prerequisite for a real integration | Status |
|---|---|
| A written agreement with a gate operator (e.g. Emaar for an Eterna-style venue) | **None** |
| The provider's interface documentation (API, events, signing, error model) | **None** |
| Credentials for a provider test environment | **None** |
| An approved test gate where entry can be tried | **None** |
| A named contact for acceptance testing and incidents | **None** |

The owner has said that Eterna and Emaar are only concepts in this
programme (2026-11-03). No operator has been approached in this phase.
Approaching one is the owner's decision.

## What exists, and was verified in Phase 24

| Piece | State | Evidence |
|---|---|---|
| Provider-neutral adapter: provision, update, revoke, status, signed events, health | Built (Phase 23) | `docs/architecture/ACCESS_PROVIDER_INTERFACE.md`, `src/lib/access/provider.ts` |
| Sandbox provider, with its own store, gate simulation and five failure modes | Built; refused on Vercel and in production builds without `ACCESS_SANDBOX=1` | Phase 23 report, item D |
| Pass lifecycle against the sandbox: request, issue, entry, revoke on cancel, no-show, removal from the venue, reschedule | **PASS (sandbox)** in Phase 24 | `ORGANIZATION_TEST_RESULTS.md` parts 3 and 4 |
| Failure handling: provider down → the request stays pending, the cron survives, the pass is issued on recovery; callbacks duplicated 3× → recorded once | **PASS (sandbox)** | Parts 4.5 and 4.17; load test 5.6 |
| Cross-venue isolation: a pass is refused at another venue's site; a security desk cannot read another venue | **PASS (sandbox)** | Part 6.6 |
| Contingency without passes: the directory, bookings, check-in QR and reports do not depend on the gate module | **PASS** | Part 1 and Part 3 run the same with passes off; 3.7, 3.10 |

"PASS (sandbox)" means Maw3ed's side behaves correctly against a
simulated provider. It says nothing about any real gate system.

## When a partner is available: the acceptance milestone

These steps run only with the partner's written approval, on their test
environment and test gates.

1. **Contract.** Map the partner's API onto the adapter interface: what
   provision returns, how they confirm, how they sign events, their
   idempotency and their error codes. Note every place the semantics
   differ (open issue P23-A2: passes the partner holds after Maw3ed gave
   up on them).
2. **Implement.** Write a new adapter beside the sandbox. Keep its secrets
   in Vercel environment variables, never in the database. Add one DB test
   per provider behaviour.
3. **Provider contract tests**, authorised by the partner: provision,
   update a window, revoke, status, a signed event, a forged event, a
   replayed event, a timeout, a refusal.
4. **Credential issuance.** A real pass reaches a real test credential.
5. **Allowed entry** at an approved test gate, and refusal at a gate
   outside the policy.
6. **Cancellation and revocation.** A cancelled booking's pass is refused
   at the gate within the agreed time, measured end to end.
7. **Failure and contingency.** The provider is unreachable, so the
   security desk's manual procedure takes over (`LAUNCH_READINESS.md`,
   "Access incident response"). The desk escalation reaches the partner's
   contact.
8. **Sign-off** by the partner's security lead and the owner. Only after
   that may a venue's provider be switched from the sandbox to the real
   adapter, on production, by a platform administrator.

Until then:

* The sandbox stays available on QA builds only.
* Venues run without gate passes.
* No screen, document or message says a pass opens a real gate.
* Nothing unrelated waits on this milestone: every other Phase 24 item is
  rated without it.
