# Venue and business relationships

Three relationships, modeled separately because they mean different
things. None of them transfers ownership of a business.

| Relationship | Table | Meaning | Who starts it | Who decides |
|---|---|---|---|---|
| **Association** | `OrganizationBusiness` | The business belongs to the organization's directory, as OWNED (the organization's own brand), FRANCHISE (operated by a franchisee), TENANT (independently owned, trading in the organization's property) or PARTNER | Organization (**invitation**) or business (**request**) | The other side: the business owner accepts or declines an invitation; an organization owner/manager approves or rejects a request |
| **Placement** | `VenueMembership` (Phase 22) | The business — or one of its branches — trades inside a specific venue (floor, unit) | Business request, or the organization when accepting an invitation that named a venue | The venue's managers (and the organization's, who manage all its venues) |
| **Ownership** | `Business.ownerId` | The account that owns the business and everything in it | Onboarding | Never changed by any of the above |

## Rules

- A business can be associated with several organizations (a clinic in
  a mall that is also part of a clinic group) and placed in several
  venues — each branch in its own.
- At most one live (invited, requested or approved) association per
  organization, business and branch; at most one live placement per
  venue, business and branch.
- A business with several active branches is associated and placed by
  branch, so an organization is shown — and counts — only the branch it
  relates to.
- Removing an association or a placement never deletes the business,
  its bookings, customers or anything else; the business simply stops
  appearing on the organization's pages.
- An invitation to an email address (to create a new business under the
  organization) is accepted by that account completing onboarding with
  the invitation; the new business is owned by that account.
- Listing on public pages requires: association APPROVED, organization
  APPROVED and published, and the business's own page published. A
  placement additionally requires the venue to be ACTIVE and published
  for the venue page.

## Lifecycle

```
            invite                     accept
ORG ───────────────▶ INVITED ───────────────────▶ APPROVED ──remove/leave──▶ REMOVED
                         │ decline                    ▲
                         ▼                            │ approve
                      DECLINED      BUSINESS ──request──▶ REQUESTED ──reject──▶ REJECTED
```

Every transition is conditional on the state it leaves (two people
deciding at once cannot both win) and is written to the audit log with
the authority it was made under.
