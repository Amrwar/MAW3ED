import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next 16.4 turned on the React Compiler's rule against
  // setState inside an effect. These files already did it — resetting a
  // form or a list when a prop changes, which behaves correctly — so in
  // them it warns, to fix as each is next touched. Everywhere else, and
  // in any new file, it stays an error. Remove a file once it is clean.
  {
    files: [
      "src/app/businesses/_components/BusinessesClient.tsx",
      "src/app/dashboard/analytics/_components/AnalyticsClient.tsx",
      "src/app/dashboard/bookings/_components/BookingsClient.tsx",
      "src/app/dashboard/bookings/_components/CollectBalance.tsx",
      "src/app/dashboard/customers/_components/CustomerDetailPanel.tsx",
      "src/app/dashboard/services/_components/ServicePanel.tsx",
      "src/app/dashboard/staff/_components/StaffPanel.tsx",
      "src/app/onboarding/_components/OnboardingForm.tsx",
      "src/features/company/BookingWidget.tsx",
      "src/features/dashboard/ManualBookingPanel.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The mobile app is its own project with its own TypeScript and
    // lint config; linting React Native with the Next rules reports
    // noise about rules that do not apply to it.
    "mobile/**",
  ]),
]);

export default eslintConfig;
