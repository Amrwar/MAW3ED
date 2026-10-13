import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "maw3ed.city";

/**
 * The city Home shows, chosen by the person and remembered on the
 * device. "" is every city.
 *
 * Chosen rather than detected: businesses are filed by city, not by
 * coordinates, so "near me" can only honestly mean "in my city" — and
 * a location permission asked for that would be asking for more than
 * the answer uses.
 */
export function useHomeCity() {
  const [city, setCityState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setCityState(v ?? ""))
      .catch(() => setCityState(""));
  }, []);

  const setCity = useCallback((slug: string) => {
    setCityState(slug);
    AsyncStorage.setItem(KEY, slug).catch(() => undefined);
  }, []);

  /** null until the stored choice has been read. */
  return { city, setCity };
}
