import * as Sentry from "@sentry/nextjs";
import { sharedOptions } from "@/lib/sentry-shared";

Sentry.init({ ...sharedOptions });
