import { describe, it, expect, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { appEnv: "development", apiUrl: "http://localhost:3000" } } },
}));

const { parseConfig } = await import("./config");

describe("parseConfig", () => {
  it("reads a valid config and trims a trailing slash", () => {
    expect(parseConfig({ appEnv: "production", apiUrl: "https://www.maw3ed.net/", eas: { projectId: "p" } })).toEqual({
      appEnv: "production",
      apiUrl: "https://www.maw3ed.net",
      easProjectId: "p",
    });
  });

  it("treats a missing EAS project as not configured, not as an error", () => {
    expect(parseConfig({ appEnv: "development", apiUrl: "http://192.168.1.5:3000" }).easProjectId).toBeNull();
  });

  it("ignores an EAS project id that is not a string, rather than refusing to start", () => {
    expect(parseConfig({ appEnv: "development", apiUrl: "http://x.test", eas: { projectId: {} } }).easProjectId).toBeNull();
  });

  it("names what is wrong", () => {
    expect(() => parseConfig({ appEnv: "prod", apiUrl: "nowhere" })).toThrow(/appEnv.*apiUrl|apiUrl.*appEnv/);
    expect(() => parseConfig(undefined)).toThrow(/invalid app config/);
  });
});
