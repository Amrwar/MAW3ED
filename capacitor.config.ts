import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.maw3ed.app",
  appName: "موعد",
  webDir: "out",
  server: {
    url: "https://maw-3-ed.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#ffffff",
  },
  ios: {
    backgroundColor: "#ffffff",
    contentInset: "automatic",
  },
};

export default config;
