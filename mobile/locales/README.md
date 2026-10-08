# Locale strings

iOS shows these, not the English defaults, when the phone is set to the
matching language. Referenced from `app.config.ts` under `locales` — a
missing file here is not a warning: `expo export` fails outright with
`ENOENT ... locales/ar.json`, which is how these came to be written.

Permission strings are the part that matters. Apple rejects an app whose
usage description is vague or absent, and the person reading it is
deciding whether to say yes, so each one says what the permission is
*for* rather than restating its name.

Only keys iOS actually reads belong here; the app's own copy lives in
the screens.
