# Push notifications — setup and verification

Push goes **server → Expo push service → Apple (APNs) / Google (FCM) → phone**.
The server never talks to Apple or Google directly; Expo holds those
credentials. Code: `src/lib/services/expo-push.ts` (sender),
`src/lib/notifications/channels.ts` (`pushChannel`, which events push),
`mobile/features/notifications/push.ts` (permission, token, taps).

**Status: built and unit-tested; not yet verified on a physical device.**
Until the steps below are done and a push has been seen arriving on a real
iPhone and Android phone, push is not production-ready.

## One-time setup (owner of the Apple / Google / Expo accounts)

1. **EAS project** — in `mobile/`: `npx eas init`. Put the project id in
   `EAS_PROJECT_ID` (local `.env`, and the EAS build environment). The app
   reports push as "not set up" without it.
2. **iOS (APNs)** — needs a paid Apple Developer account.
   `npx eas credentials -p ios` → *Push Notifications* → let EAS create an
   APNs key (or upload an existing `.p8`). Nothing goes in the repo.
3. **Android (FCM v1)**
   - Create a Firebase project, add an Android app with package
     `net.maw3ed.app` (and `.staging` / `.dev` if you build those),
     download `google-services.json`.
   - Give it to the build **without committing it**: EAS file variable
     `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`
     (or place it at `mobile/google-services.json` for local builds — it
     is gitignored).
   - Firebase console → Project settings → Service accounts → generate a
     private key (JSON). `npx eas credentials -p android` → *Google Service
     Account* → *FCM V1* → upload it.
4. **Server** — optional but recommended for production: Expo dashboard →
   Access tokens → create one, enable "Enhanced push security", and set
   `EXPO_ACCESS_TOKEN` in Vercel. Expo then refuses pushes without it.
5. **Build** — push does not work in Expo Go on Android (SDK 53+), and the
   iOS simulator cannot receive remote pushes. Use a development build:
   `npx eas build --profile development -p android` / `-p ios`.

## What sends, and to whom

| Event | Customer | Business owner |
|---|---|---|
| Booking created | — (they just made it) | ✓ if "new bookings" alerts on |
| Confirmed / declined | ✓ | — |
| Rescheduled (by customer) | — | ✓ if "new bookings" alerts on |
| Cancelled | ✓ if the business cancelled | ✓ if the customer cancelled and "cancellations" on |
| Reminder / starting soon | ✓ | — |
| Review request | ✓ | — |
| Payment received / failed | ✓ | ✓ if "payments" alerts on |
| Subscription due / expired | — | ✓ |

Every push is also in the in-app feed. Each (event, recipient, channel) is
claimed once in `NotificationDelivery`, so a retried webhook or a cron that
runs twice cannot push twice. Dead tokens (`DeviceNotRegistered`) are
disabled automatically. The payload carries only `kind`, `path` and — for a
customer — `bookingId`; the booking's access token is fetched by the app
over its signed-in connection (`GET /api/account/bookings/[id]`), never put
in the push.

Preferences: the customer's "Notifications on this phone" switch (Account
and Notifications screens) registers or removes this device; signing out
and deleting the account remove it too. Owners' per-event switches are the
existing business notification settings.

Content is Arabic (the product language); the server does not yet know a
device's app language.

## Device verification checklist

Run on one iPhone and one Android phone with a development build, signed in
as a customer, and on a second phone signed in as the business owner.

- [ ] Turn on notifications from the Notifications screen → system prompt →
      `DeviceToken` row appears for the user.
- [ ] **Foreground**: owner confirms a booking → banner shows while the app
      is open; the bookings list refreshes.
- [ ] **Background**: app in background → notification in the tray.
- [ ] **Closed**: app swiped away → notification arrives; tapping it opens
      the app on that booking's screen.
- [ ] **Tapped (owner)**: new booking push → opens the business bookings tab.
- [ ] **Deep link**: tap lands on `/booking/<token>` for the customer.
- [ ] Turn the switch off → no more pushes; feed still updates.
- [ ] Sign out → token removed; next account on the phone gets nothing of
      the previous one's.
- [ ] Uninstall → next push marks the token disabled (`disabledAt` set).
- [ ] Each push appears once (check `NotificationDelivery` for PUSH rows).
