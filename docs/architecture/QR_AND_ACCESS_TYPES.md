# QR codes and access types

Maw3ed produces several kinds of code. They look alike and are not
interchangeable; each is labelled where it is shown.

| Kind | Encodes | Secret? | Who gets it | Proves | Phase |
|---|---|---|---|---|---|
| **Organization directory QR** | `https://www.maw3ed.net/groups/<slug>?src=qr` | No — public marketing | The organization, to print on signs | Nothing; it is a link. Scans are counted as QR visits | 22 |
| **Venue QR** | `https://www.maw3ed.net/venues/<slug>?src=qr` | No | The organization / venue | Nothing; a link | 22 |
| **Business booking QR** | `https://www.maw3ed.net/company/<slug>?src=qr` | No | The business (existing `/api/business/qr`) | Nothing; a link | existing |
| **Booking check-in QR** | A check-in URL carrying the booking reference | No (opening it reveals nothing to anyone but that business's own staff) | The customer, on the booking page | That a booking exists, to the business that holds it, when its staff scan it | 23 |
| **Visitor pass** | An opaque token issued through an **access provider** | Yes | A visitor admitted by an eligible booking at a venue that has visitor access switched on | Permission to enter, **only as far as the provider accepts it** | 23 (optional module) |

## Separation

- **Booking confirmation** is the booking itself (status CONFIRMED). It
  exists whether or not any access system is involved.
- **Check-in** is the business recognising the booking at its own door.
  It never opens a compound gate.
- **Gate access** belongs to the venue's access provider. Maw3ed can
  decide *who may request entry* (an entitlement) and pass that to an
  approved provider; the provider issues and confirms the credential. A
  credential is shown as usable only after the provider confirms it.

## When no provider is configured

- Organization and venue pages, bookings, booking check-in codes and
  business dashboards work normally.
- The visitor-access section says that passes are not available at this
  venue and shows the venue's own entry instructions.
- No code is shown that claims to open any gate. The development sandbox
  provider is refused in production, and its codes are marked
  "not valid at any gate".

## External applications

Provider-neutral adapter interface (Phase 23): official API, approved
webhooks, approved redirect/deep link, approved credential hand-off or an
operator-approved check-in application. Each real provider is added only
with that operator's written agreement and specification. Nothing guesses
or reverse-engineers a private gate protocol.
