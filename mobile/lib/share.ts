import { Platform, Share } from "react-native";

/**
 * Sharing a public Maw3ed link (a business, an organization): the
 * system share sheet on a phone; in the browser preview the browser's own
 * sheet where there is one, else a copy to the clipboard, else the link
 * shown to copy by hand. Dismissing a share sheet is not an error.
 */
export async function shareLink(
  opts: { url: string; title: string; message: string },
  tell: (message: string, tone: "ok" | "info") => void,
  copied: string,
): Promise<void> {
  const { url, title, message } = opts;
  if (Platform.OS === "web") {
    const nav = globalThis.navigator as Navigator | undefined;
    // The browser's share sheet where there is one. It is missing on
    // most desktops and refuses outside a user gesture or a secure
    // page; anything but the person closing it falls through to a copy.
    if (nav?.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      if (!nav?.clipboard) throw new Error("no clipboard");
      await nav.clipboard.writeText(url);
      tell(copied, "ok");
    } catch {
      // No clipboard either (an http page): show the link to copy by hand.
      tell(url, "info");
    }
    return;
  }
  try {
    await Share.share(Platform.OS === "ios" ? { message: title, url } : { message, title });
  } catch {
    // Dismissing the share sheet is not an error worth a message.
  }
}
