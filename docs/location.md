# Location — how it works and what it needs

## Data

- `Business.latitude/longitude` and `Branch.latitude/longitude` — optional,
  both-or-neither, range-checked in the database
  (`prisma/migrations/add_business_location.sql`, safe to run twice).
- Set **only** by the owner: Dashboard → Settings → profile → "Location on
  the map", and per branch in Dashboard → Branches. They paste a Google
  Maps link (or type `lat, lng`); `src/lib/geo.ts` reads the coordinates
  out of it. Nothing is geocoded from an address or invented.
- A business with no pin keeps working everywhere; it just isn't on the map
  or in "near me". Until owners add pins, "near me" will be quiet — the
  screen says why and offers search by area.

## Query

`GET /api/public/businesses/nearby?lat&lng&radius&limit&category&q` —
`src/lib/discovery/nearby.ts`. Bounding box on indexed columns, then
haversine distance over each business's pin and its active branches'; a
business is as near as its nearest location. Same filters as search. The
person's coordinates are not logged or stored, and the response is
`Cache-Control: private, no-store`.

## App

`app/nearby.tsx` ("Places near me" on Home). Permission is asked only when
the person taps "Use my location": foreground "when in use", one reading,
no tracking, no background. Denied/blocked/services-off/timeout/inaccurate
each have their own message; search by area (cities) needs no permission.
List/map switch; markers for every pin incl. branches; directions use the
owner's pin when there is one.

## Setup to do

1. Apply `prisma/migrations/add_business_location.sql` to production.
2. Android store builds need a Google Maps key: Google Cloud console →
   enable "Maps SDK for Android" → create a key restricted to the app's
   package + SHA-1 → set `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS build
   environment. iOS uses Apple Maps (no key). Expo Go works without one.
3. Ask owners to set their pin (Dashboard → Settings).
