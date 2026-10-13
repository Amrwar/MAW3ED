# Maw3ed mobile app — architecture

Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router, TanStack
Query. Lives in `mobile/`.

There is **one backend**: the Next.js app. The mobile app is a client of
its `/api` routes. Business rules stay on the server, and the app does
not re-implement them.

## Layout

```
mobile/
  app/                     routes only — thin files that compose features
    _layout.tsx            providers, crash screen, push-tap routing, screen tracking
    +native-intent.tsx     every OS-delivered link → lib/links.ts
    index.tsx              the gate: sends each role to its space
    (auth)/login.tsx       phone code (customers) or email+password (owners)
    (customer)/            Home · Search · Bookings · Favorites · Notifications · Account
    (business)/            Dashboard · Calendar · Bookings · Customers · Notifications · Account
    (admin)/               Overview · Account — deliberately small
  features/
    auth/                  AuthProvider, token-store (Keychain/Keystore), api, roles,
                           validation, SignInGate, RoleSwitcher
    notifications/         feed queries, NotificationsScreen, push registration
    customer/ business/    each role's queries
    admin/                 admin queries
    bookings/ discovery/   UI shared across roles (BookingCard, BusinessCard, status)
  lib/
    api/                   the one HTTP client: bearer, refresh-once, typed errors
    query/                 QueryClient defaults and every cache key
    config.ts              validated build config (env, API URL, EAS project)
    links.ts               website path → app route, for links and notifications
    analytics.ts           track/screen interface; no vendor yet
  components/ui/           design-system primitives
  constants/               theme tokens (mirrors the web's), version
  types/api.ts             server response shapes, transcribed from the routes
```

## How the app talks to the backend

- **Client.** `lib/api/client.ts` is the only thing that calls `fetch`.
  - It attaches the bearer token.
  - On a 401 it refreshes once, sharing the refresh between concurrent
    calls, and retries the request.
  - It times out after 15 seconds.
  - It turns failures into `NetworkError`, `UnauthorizedError` or
    `ApiError`, which carries the server's own Arabic message.
- **Session ended.** When the session ends underneath the app,
  `onSessionExpired` fires once. The auth provider signs out and clears
  the cache.
- **Server side.** Bearer tokens are accepted by `requireSession()` and
  `requireBusiness()`, and now by the admin guard as well. The role is
  always re-read from the database, never trusted from the token.
  `src/lib/api-bearer-coverage.test.ts` keeps routes from reading only
  the web cookie.

### Auth endpoints

| | |
|---|---|
| `POST /api/auth/mobile/login` | email + password (owners, staff, admins) |
| `POST /api/auth/phone/send` | the website's own code request, used as-is |
| `POST /api/auth/mobile/otp` | phone + code → tokens (customers). **New this phase.** |
| `POST /api/auth/mobile/refresh` · `/logout` · `GET /me` | session lifecycle |

All sign-in routes build their response with `src/lib/auth/mobile-session.ts`.
The OTP route verifies with the same `verifyLoginCode` and
`accountForVerifiedPhone` functions as the website's NextAuth provider.

### Tokens

- Stored with `expo-secure-store`: the Keychain on iOS (this device
  only, readable once the phone is unlocked, not backed up) and the
  Keystore on Android.
- Never stored in AsyncStorage.
- The user object is not cached. `/me` answers on every cold start.

## Roles and spaces

- `rolesFor(user)` gives admin, business and customer, most privileged
  first.
- The gate opens the first space. `RoleSwitcher` moves between spaces
  for accounts that are more than one.
- Each space's layout redirects anyone without the role.
- The server enforces the same rules on every request.
- **Customer space.** Open to signed-out visitors, because browsing
  needs no account. Bookings, Favorites, Notifications and Account sit
  behind `SignInGate`, so their queries never run anonymously.
- **Admin space.** One screen, `GET /api/admin/overview`, with the same
  figures as the web admin's landing page, computed by
  `src/lib/admin/overview.ts`. Moderation, refunds and audit stay on the
  web.

## Notifications

- **Feed.** The in-app feed is `/api/account/notifications`, the same
  one the website's bell uses, for every role.
- **Push token.**
  - Permission is asked only from the Notifications screen, never on
    launch.
  - The Expo push token is registered with the existing
    `POST /api/mobile/devices`.
  - The device is unregistered before sign-out.
- **Tapping a push.** The notification's `href` (a website path) is
  routed through `lib/links.ts`, including when the tap launched a
  closed app.
- **Not yet built:** the server does not send push. The `PUSH` channel
  in `src/lib/notifications/channels.ts` has no sender. Adding one means
  posting to Expo's push service with the stored tokens; the app needs
  no change.

## Deep links

- **Supported forms:** `maw3ed://…` everywhere; `https://(www.)maw3ed.net/company/*`
  and `/booking/*` in production builds only.
- **Routing.** `+native-intent.tsx` sends every link through `routeFor`.
  A page the app does not have yet lands on the nearest screen, never on
  "not found".
- **Domain files.** The website serves `/.well-known/apple-app-site-association`
  and `/.well-known/assetlinks.json` from `APPLE_TEAM_ID` and
  `ANDROID_CERT_SHA256`. They answer 404 until those are set, and links
  then open in the browser.
- **Staging and development builds** do not claim the domain, so a
  tester's phone never takes customers' links.

## Environments

| Profile (`eas.json`) | `APP_ENV` | Bundle / package | API |
|---|---|---|---|
| development | development | `net.maw3ed.app.dev` | `EXPO_PUBLIC_API_URL`, default `http://localhost:3000` |
| preview | staging | `net.maw3ed.app.staging` | set in `eas.json` |
| production | production | `net.maw3ed.app` | set in `eas.json` |

- No URL or secret is written in code.
- A staging or production config without `EXPO_PUBLIC_API_URL` fails
  at build time.
- `lib/config.ts` validates what reaches the app.

## Running it

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000 npx expo start   # phone and laptop on one network
npm run typecheck && npm run lint && npm test
```

The integration check runs the app's own auth code against a running
**local** backend on the QA fixtures:

```bash
MAW3ED_API_URL=http://localhost:3100 npx vitest run features/auth/auth.integration.test.ts
```

## Before the first store build

1. `eas init`, then set `EAS_PROJECT_ID`. Push tokens need it; until
   then the app reports push as not configured.
2. `eas credentials`, then set `APPLE_TEAM_ID` and `ANDROID_CERT_SHA256`
   on the website.
3. Push credentials: an APNs key and an FCM service account, through
   EAS.
4. Store listings, privacy labels and screenshots. Not part of this
   phase.

## Design system (`mobile/design/`)

Screens import from `@/design` only — never a raw colour, size or font.
The showcase at `app/dev/design-system.tsx` (development and staging
builds; reachable from any Account screen) renders every component, and
its language switch flips the whole app.

- **Tokens** (`tokens.ts`): the web's palette by value — `tokens.test.ts`
  fails if any colour drifts from `src/app/globals.css` or any text
  pairing drops below 4.5:1 — plus Almarai type, spacing, radius,
  elevation (iOS shadow + Android elevation), motion and breakpoints.
- **Deep Anchor on mobile**: `night` is the anchor (sign-in, dark
  headers, toasts), content lives on light `ground`, white `surface`
  cards are the bright things, jade is the one accent.
- **RTL is structural** (`locale.tsx`): the locale sets `direction` on
  the root view (and on every Modal, which is a separate native root);
  Yoga resolves every `start`/`end`. Text alignment comes from `Text`,
  arrows from `Icon`'s directional set, built-in words from `strings.ts`.
  `rtl.test.ts` fails on any `marginLeft`/`right:`/fixed `textAlign`,
  any `I18nManager`, or any colour literal outside the tokens.
- **Responsive** (`layout.ts`): one `useLayout()` — columns, gutter and a
  capped content width — used by `Screen`, sheets and grids. Nothing is
  built twice for phone and tablet.
- **Accessibility**: 48pt targets everywhere (hitSlop where the visual is
  smaller), capped Dynamic Type per text style, labels on every control,
  state as `aria-*` (read on iOS, Android and web), one summarising label
  per card, announced toasts, reduced-motion-aware skeletons.

Components: Text, Icon, Touchable, Button, IconButton, TextField,
SearchField, Select, Card, BusinessCard, ServiceCard, StaffCard,
BookingCard, Tabs, Chip, Badge, Avatar, Rating, RatingInput, Header,
Screen, bottom navigation (`bottomNavOptions`/`tabIcon`), Sheet, Dialog,
ConfirmDialog, Toast, Loading, Skeleton, EmptyState, ErrorState,
ListState, DateStrip, Calendar, TimeSlots.
