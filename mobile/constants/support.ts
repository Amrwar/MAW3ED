import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

/**
 * Where a person is sent when they need a human, or the legal pages.
 *
 * Mirrors the web's src/lib/support.ts (the two build separately). The
 * site is always production's: the privacy policy and the support inbox
 * are the real ones whichever build is asking — a staging build pointing
 * a tester at a preview's privacy page would be pointing at a copy.
 */
export const SITE_URL = "https://www.maw3ed.net";
export const SUPPORT_EMAIL = "support@maw3ed.net";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const CONTACT_URL = `${SITE_URL}/contact`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;

/** In-app browser on native, a new tab on web; the system browser if that fails. */
export function openExternal(url: string): void {
  if (Platform.OS === "web") {
    void Linking.openURL(url);
    return;
  }
  void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}
