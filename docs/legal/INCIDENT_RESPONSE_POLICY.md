# Incident response policy

Status: DRAFT for legal review, 2026-10-29. The operational steps are
in `docs/runbooks/SECURITY_OPERATIONS.md` § 6; this is the policy.

## What counts as an incident

Any event that does, or may, expose, alter or destroy personal data or
money records, or deny the service: a leaked secret, an account
takeover, a forged or missed payment callback, a lost or wrongly
restored database, a vulnerability exploited or credibly reported, a
provider breach affecting our data.

## Roles

- **Incident lead:** the owner (the only holder of production
  credentials). Decides containment and communication.
- **Engineering:** investigates, fixes, writes the post-incident note.
- **Counsel:** advises on notification duties and wording
  [DECISION: who].

## Timeline targets

| Step | Target |
|---|---|
| Acknowledge a report (email on `/contact`, or an internal alert) | 24 hours |
| Contain (rotate, revoke, pause payments) | as soon as understood, within 24 hours of confirmation |
| Assess scope (which people, what data) | 72 hours |
| Notify affected people and businesses | without undue delay once scope is known; [LEGAL: Law 151/2020 and its regulations set the regulator-notification window and content — confirm the number of hours/days] |
| Notify the Personal Data Protection Centre | [LEGAL: when required, within the legal window] |
| Notify Paymob | same day, for anything touching payments |
| Post-incident note | 2 weeks |

## What we tell people

Plainly: what happened, what data, what we did, what they should do
(for example, sign out everywhere, change a password elsewhere if they
reused it), how to reach us. Never speculation about who, and never
less than we know.

## Evidence

Before cleaning anything: export the relevant `AuditLog`,
`WebhookEvent`, `NotificationDelivery` and `MobileSession` rows and the
Vercel logs for the window, into storage only the incident lead can
read. Keep for [DECISION: 2 years].

## Vulnerability reports from outside

Email on `/contact` with "security" in the subject; acknowledged within
24 hours; no legal action against good-faith researchers who do not
access others' data or disrupt the service [DECISION: publish a
`/.well-known/security.txt`].

## Review

This policy is reviewed yearly and after every incident.
