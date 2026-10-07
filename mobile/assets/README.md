# App assets

These are the real Maw3ed marks, copied from the web app's `public/`
folder so the app ships with its own identity rather than Expo's
default. They are a correct starting point, not a finished set.

Before a store submission:

- `icon.png` wants to be **1024×1024** with no transparency and no
  rounded corners — iOS applies its own mask, and a pre-rounded icon
  gets rounded twice. The current file is 512×512, which builds but
  will be upscaled.
- `adaptive-icon.png` is the Android foreground layer. Keep the mark
  inside the middle **66%**: Android crops it to a circle, a squircle
  or a rounded square depending on the launcher, and anything near the
  edge is cut on some devices.
- `notification-icon.png` must be a **white silhouette on transparent**.
  Android ignores the colours and draws whatever is opaque, so a full
  colour logo arrives as a white blob.
- `splash.png` is centred on `#11201C` at `resizeMode: contain`, so it
  wants generous padding built in rather than filling its canvas.
