import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api/client";

/**
 * "Download my data": everything the account can see about itself, as
 * JSON, from GET /api/account/export (the website's own export: the
 * profile, bookings, payments, reviews, saved places — nothing about
 * anybody else). Saved to the phone's cache and handed to the share
 * sheet, so the person chooses where it goes; the browser preview
 * downloads it. The server limits how often it can be asked.
 */
export type ExportResult = "shared" | "downloaded" | "unavailable";

const PREFIX = "maw3ed-my-data-";

export function exportFileName(now = new Date()): string {
  return `${PREFIX}${now.toISOString().slice(0, 10)}.json`;
}

/** An export written to the cache for the share sheet; nothing else there is. */
export function isExportFile(name: string): boolean {
  return name.startsWith(PREFIX) && name.endsWith(".json");
}

/**
 * Removes exports left in the phone's cache (before a new one is written,
 * and on sign-out), so a copy of somebody's data is not left behind for
 * whoever uses the phone next. Not right after the share sheet: the app
 * it went to (mail, Drive, a chat) may read the file later. Best effort.
 */
export async function forgetExports(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    for (const item of new Directory(Paths.cache).list()) {
      if (item instanceof File && isExportFile(item.name)) item.delete();
    }
  } catch {
    // Never fails a sign-out.
  }
}

export async function exportMyData(): Promise<ExportResult> {
  const data = await api.get<unknown>("/api/account/export", { timeoutMs: 30_000 });
  const text = JSON.stringify(data, null, 2);
  const name = exportFileName();
  if (Platform.OS === "web") {
    const href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return "downloaded";
  }
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await forgetExports();
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: name, UTI: "public.json" });
  return "shared";
}
