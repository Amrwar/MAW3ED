import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The Google button is drawn from the server's answer, in the first
 * HTML: nothing at all (not even its "or" line) when Google is not
 * configured, the button and the line when it is.
 */

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import GoogleButton from "./GoogleButton";
import { AuthOptionsProvider } from "./AuthOptions";
import { LanguageProvider } from "@/contexts/LanguageContext";

function render(google: boolean, lang: "ar" | "en" = "en") {
  // Children as createElement's third argument; the casts only tell
  // TypeScript that the props object is complete without them.
  const button = createElement(GoogleButton, { redirectTo: "/login", divider: "or use your email" });
  const options = createElement(AuthOptionsProvider, { value: { google } } as ComponentProps<typeof AuthOptionsProvider>, button);
  return renderToStaticMarkup(
    createElement(LanguageProvider, { initialLang: lang } as ComponentProps<typeof LanguageProvider>, options),
  );
}

describe("GoogleButton", () => {
  it("renders nothing when Google is off", () => {
    expect(render(false)).toBe("");
  });

  it("renders the button and the divider when it is on", () => {
    const html = render(true);
    expect(html).toContain("Continue with Google");
    expect(html).toContain('type="button"');
    expect(html).toContain("or use your email");
  });

  it("speaks Arabic on an Arabic page", () => {
    expect(render(true, "ar")).toContain("كمّل بحساب Google");
  });
});
