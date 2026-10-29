# Legal drafts

Drafts prepared in Phase 20 (2026-10-29) from what the code actually
does. They are **not** legal advice, have **not** been reviewed by
counsel, and claim no compliance or certification. Each one separates:

- **Fact** — what the software does today, with the file that does it;
- **Decision** — a choice the business has to make before publishing;
- **Legal question** — something only qualified counsel (Egypt first,
  then any other market actually served) should answer.

| Draft | Replaces / informs |
|---|---|
| `PRIVACY_POLICY_DRAFT.md` | `src/app/privacy/page.tsx` (its VERIFY notes are carried here) |
| `TERMS_OF_SERVICE_DRAFT.md` | `src/app/terms/page.tsx` (dated March 2025, silent on money: P17-13) |
| `ACCOUNT_DELETION_POLICY.md` | `src/app/account-deletion/page.tsx` and the store listings |
| `DATA_RETENTION_POLICY.md` | nothing today: the code applies no retention |
| `INCIDENT_RESPONSE_POLICY.md` | nothing today |
| `DATA_PROCESSING_REQUIREMENTS.md` | what each provider receives, and what a business using Maw3ed must know |

Applicable law to review against: Egypt's Personal Data Protection Law
No. 151 of 2020 and its executive regulations (consent, purpose,
retention, cross-border transfer, the Personal Data Protection Centre's
licensing and notification requirements), the Consumer Protection Law
No. 181 of 2018 for terms and refunds, and the E-Signature Law for
electronic acceptance. Other markets are not served today; the code
accepts phone numbers from any country, which is a technical fact, not
a market.
