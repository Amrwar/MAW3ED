# Data retention policy

Status: DRAFT for business and legal review, 2026-10-29.

**Fact first:** the software applies **no automatic deletion** to any
of the tables below. Nothing in this phase changed that (the instruction
was not to change retention without review). The periods in the
"Proposed" column are proposals for the owner and counsel to decide;
once decided, each becomes a scheduled job in `/api/cron/subscriptions`
(daily) and a line in this document with the date it took effect.

| Data | Table(s) | Kept today | Proposed | Reason / question |
|---|---|---|---|---|
| Bookings | `Booking` | for ever | 5 years after the appointment, then anonymise name/phone/email/notes (keep the row for statistics) | Business records and disputes; [LEGAL: Egyptian commercial record-keeping period] |
| Customer records (business CRM) | `Customer` | for ever | while the business is active, then 1 year after its last booking | The business's data |
| Payments, refunds, webhook events | `Payment`, `Refund`, `WebhookEvent` | for ever | 10 years | Financial and tax records [LEGAL: Egyptian tax law period] |
| Reviews | `Review` | for ever | while the business is listed; anonymise on account deletion | Public content |
| Notification delivery log | `NotificationDelivery` | for ever; addresses removed on account deletion | 90 days, then delete rows (keep aggregate counts) | Support ("did they get it?") rarely needs older |
| In-app notifications | `Notification` | until the account is deleted | 180 days | Feed hygiene |
| Audit log | `AuditLog` | for ever | 7 years | Accountability [LEGAL] |
| Sessions | `MobileSession`, web cookie | 60 days / 30 days from sign-in | as is | — |
| One-time codes, reset/verification tokens | `LoginCode`, `PasswordResetToken`, `EmailVerificationToken`, `PhoneVerification` | until used or expired; expired rows linger | delete expired rows daily | Hygiene |
| Rate-limit counters | `RateLimit` | pruned daily (`pruneRateLimits`) | as is | — |
| Profile views | `ProfileView` | for ever (aggregate, no identifier) | 2 years | Owner analytics |
| Released phone hashes | `PhoneRelease` | for ever | 3 years | Long enough for a recycled number to pass through a new holder [DECISION] |
| Server logs | Vercel | Vercel's retention | per plan | [owner to record] |
| Database backups | Neon | per plan | 30 days PITR + monthly dumps for 6 months | see `SECURITY_OPERATIONS.md` § 3 |
| Uploaded images | Cloudinary | until the business deletes or is deleted | delete with the business | — |

Deletion on request: see `ACCOUNT_DELETION_POLICY.md`. Business
closure: [DECISION: what is deleted when a business leaves; today the
listing is unpublished and the data stays].
