import { db } from "@/lib/db";
import { fakePaymobEnabled, signedCallback } from "@/lib/services/paymob-fake";
import { log } from "@/lib/logger";

/**
 * GET/POST /api/dev/paymob/checkout — the fake hosted payment page.
 *
 * Local QA only (lib/services/paymob-fake.ts): a 404 everywhere else.
 * GET shows the amount and two buttons; POST sends the same signed
 * callback Paymob would to the real webhook route, then forwards to the
 * real /payment/return page, as Paymob's redirect does.
 */

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(req: Request) {
  if (!fakePaymobEnabled()) return notFound();
  const u = new URL(req.url);
  const order = u.searchParams.get("order") ?? "";
  const payment = await db.payment.findUnique({
    where: { providerOrderId: order },
    select: { amountCents: true, currency: true, status: true },
  });
  if (!payment) return notFound();

  const amount = (payment.amountCents / 100).toFixed(2);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test checkout</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f7f5;margin:0;padding:24px;color:#11201c}
.card{max-width:420px;margin:40px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.tag{display:inline-block;background:#fff4d6;color:#7a5500;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}
h1{font-size:20px;margin:16px 0 4px}.amt{font-size:32px;font-weight:800;margin:8px 0 24px}
button{width:100%;padding:14px;border-radius:12px;border:0;font-size:16px;font-weight:700;margin-bottom:12px;cursor:pointer}
.pay{background:#0d7a5a;color:#fff}.decline{background:#fff;color:#a33;border:2px solid #e5c4c4}</style></head>
<body><div class="card"><span class="tag">LOCAL TEST CHECKOUT — NOT A REAL PAYMENT</span>
<h1>Maw3ed deposit</h1><div class="amt">${amount} ${payment.currency}</div>
<p>Status in the ledger: <b>${payment.status}</b></p>
<form method="post"><input type="hidden" name="order" value="${order.replace(/[^0-9]/g, "")}">
<button class="pay" name="outcome" value="success">Pay (simulate success)</button>
<button class="decline" name="outcome" value="decline">Decline (simulate failure)</button></form></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!fakePaymobEnabled()) return notFound();
  const form = await req.formData();
  const order = String(form.get("order") ?? "");
  const success = form.get("outcome") === "success";

  const payment = await db.payment.findUnique({
    where: { providerOrderId: order },
    select: { amountCents: true, currency: true, bookingId: true },
  });
  if (!payment) return notFound();

  // The real webhook, through HTTP, exactly as Paymob reaches it.
  const origin = new URL(req.url).origin;
  const callback = signedCallback(order, payment.amountCents, payment.currency, success);
  const res = await fetch(`${origin}/api/webhooks/paymob`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(callback),
  });
  log.info("[fake paymob] callback delivered", { order, success, status: res.status });

  // Paymob's redirect, to the return page set in its dashboard.
  const back = (process.env.PAYMOB_FAKE_RETURN_URL ?? `${origin}/payment/return`).replace(/\/+$/, "");
  const q = new URLSearchParams({
    merchant_order_id: payment.bookingId ?? "",
    success: String(success),
    pending: "false",
    order,
  });
  return Response.redirect(`${back}?${q}`, 303);
}
