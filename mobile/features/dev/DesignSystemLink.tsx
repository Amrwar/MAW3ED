import { router } from "expo-router";
import { Button } from "@/design";
import { config } from "@/lib/config";

/** The way into the design system showcase. Absent from production builds. */
export function DesignSystemLink() {
  if (config.appEnv === "production") return null;
  return (
    <Button
      label="Design system · نظام التصميم"
      variant="ghost"
      icon="color-palette-outline"
      onPress={() => router.push("/dev/design-system")}
    />
  );
}
