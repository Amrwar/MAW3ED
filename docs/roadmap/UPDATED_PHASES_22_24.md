# Updated roadmap: Phases 22–24

Revised 2026-10-31 on the owner's instruction: organizations are a
generic product; gate integration is one optional module, and only the
live partner connection depends on an external party.

| Phase | Scope | Depends on an external party? |
|---|---|---|
| **22** | Generic parent organizations (malls, compounds, commercial buildings, business groups, franchises): registration, review, profile, members and roles, locations/venues, business associations (invite, request, approve, remove), venue placement, public organization directories, links and QR codes, visits and booking attribution, organization dashboard, audit. Builds on the Phase 22 venue work (venues, floors, gates, policies, tenancy, venue console, venue pages) | No |
| **23** | Booking check-in QR for businesses; optional visitor-pass module (entitlements, guest passes, validity windows, revocation, status, audit, security desk); provider-neutral access adapter with a development sandbox | No — except the live connection to a specific operator's system |
| **24** | End-to-end organization and venue launch testing on production, including configuring Eterna from the operator's data. **External acceptance milestone:** certification of a real gate provider (e.g. Emaar) — only with that operator's agreement, documentation and test environment | Only the external acceptance milestone |

What was delivered under the earlier Phase 22 instructions (venues,
compounds, floors, gate metadata, visitor policies, venue tenancy and
roles, venue pages and console) is kept and becomes the "locations"
layer of the organization platform.

The earlier Phase 23 draft (gate discovery first) is superseded: its
domain model and cryptography are kept on branch `phase-23-access` and
resume in Phase 23 as the optional module.
