-- Stripe as a second provider for plan payments (businesses buying Pro or
-- Premium). Customer booking payments stay on Paymob.
--
-- Additive and idempotent. Run BEFORE the Stripe code deploys: the code
-- writes Payment.provider = 'STRIPE' and WebhookEvent.provider = 'STRIPE'.
-- An enum value cannot be removed once added; leaving it unused is harmless.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'STRIPE';
