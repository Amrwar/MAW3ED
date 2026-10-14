# Deep links

One Maw3ed link works everywhere. Every link the system writes is a
`https://www.maw3ed.net/...` web page. On a phone with the app, iOS
(Universal Links) and Android (App Links) open it in the app; without
the app it is simply the web page. Nothing the system sends depends on
the app being installed, so no link is ever broken.

## What opens where

| Link | Written by | Web page | App screen |
|---|---|---|---|
| `/company/<slug>` | business sharing, social bio links, search | business profile | business screen |
| `/company/<slug>?src=qr` (or `instagram`, `whatsapp`, …) | QR codes, link builder | profile, visit counted by source | business screen, visit counted by the same source |
| `/company/<slug>?service=<id>[&staff=<id>]#booking` | service share links | profile with the booking form preselected | booking flow, starting at that service (and staff member) |
| `/booking/<token>` | confirmation email and WhatsApp, account pages | the booking | the booking |
| `/booking/<token>#review`, `#reschedule` | review request, account pages | the booking, scrolled to that part | the review / reschedule step |
| `/dashboard/bookings?booking=<id>` | business notifications (push and in-app) | dashboard (sign-in required) | that booking on the business side |

The app's translation is `mobile/lib/links.ts` (`routeFor`), used by
`app/+native-intent.tsx` (links from outside), push taps
(`app/_layout.tsx`) and the in-app feed. Only the paths in its table
reach a screen; anything else opens the home screen, never "not found".

Only `/company/` and `/booking/` are claimed by the app (iOS
`associatedDomains`, Android `intentFilters`, and the site's
`/.well-known/` files). The rest of the site stays in the browser.

### Validation

Every value a link carries is checked before it reaches a route: slugs
(`[a-z0-9_-]`), booking tokens (16–128 alphanumerics), ids, sources. A
value that fails is dropped, never passed on (`links.test.ts`).

### Security

Opening a link grants nothing.

- A booking page is reached by its token, exactly as on the web. The
  token is the authorisation; it is never sent through push.
- The business side (`/manage/*`, the business tabs) asks a signed-out
  person to sign in and then returns to the same screen; the server then
  checks, on every request, that they may see it — a provider opening a
  colleague's booking gets "not available".
- A customer's bookings and account sit behind sign-in.
- `/dashboard` on the web requires sign-in.

### Missing things

- **Deleted or unpublished business:** web 404 page; app "this place
  isn't available" with a way back to search.
- **Deleted service:** the web profile still opens; the app's booking
  flow says the linked service isn't offered any more and shows the
  others.
- **Invalid booking link:** web 404; app opens My bookings.
- **Unknown path:** web 404; app opens home.

## Setup (once, for the production app)

The site serves the two verification files only when it knows the app's
identity. Until then they answer 404 and links open in the browser —
which works, just not in the app.

1. **iOS** — in Vercel (production), set `APPLE_TEAM_ID` to the Team ID
   from developer.apple.com → Membership. The bundle id is
   `net.maw3ed.app` (`src/lib/app-links.ts`).
2. **Android** — after the first production build, run
   `eas credentials` (Android → production → Keystore) and copy the
   SHA-256 fingerprint. If the app is published through Google Play with
   Play App Signing, also add the *app signing key* fingerprint from Play
   Console → Setup → App integrity. Set `ANDROID_CERT_SHA256` in Vercel to
   one or both, comma-separated.
3. Redeploy, then check:
   - `https://www.maw3ed.net/.well-known/apple-app-site-association`
   - `https://www.maw3ed.net/.well-known/assetlinks.json`
   - Google's checker: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.maw3ed.net&relation=delegate_permission/common.handle_all_urls`

**Production `AUTH_URL` must be `https://www.maw3ed.net`** (it is, as of
October 2026). It is the origin every generated link uses — QR codes,
emails, shares — so a bare-domain value would quietly make every link
open the browser. If it is ever changed, sign-in callbacks follow it.

**Always link to `www.maw3ed.net`.** The bare domain redirects to www,
and neither Apple nor Google follows a redirect when verifying, so the
app claims www only. Links the system writes already use www
(`src/lib/url.ts`, `src/lib/env.ts`).

## Testing on devices

Universal and App Links can only be fully tested on a real phone with a
production build (development and staging builds use `maw3ed://`).

| Case | How | Expect |
|---|---|---|
| App installed, closed | Tap a profile link in Notes/WhatsApp | App opens on the business |
| App installed, in background | Same | App comes forward on the business |
| App not installed | Same | Web profile |
| Logged out, business notification | Tap it | Sign in, then the booking |
| Logged in, customer confirmation | Tap the WhatsApp link | The booking in the app |
| QR code | Scan the business's QR | Business screen; the visit counts as QR in the dashboard |
| Service link | Share a service, open it | Booking flow at that service |
| Invalid link | `/booking/abc` | My bookings (app) / 404 (web) |
| Deleted business | Unpublish, open its link | "Not available" / 404 |
| Deleted service | Hide a service, open its link | Notice + other services |

On Android, `adb shell pm get-app-links net.maw3ed.app` shows whether
www.maw3ed.net verified. On iOS, a long-press on a link shows "Open in
موعد" when the association is in place.
