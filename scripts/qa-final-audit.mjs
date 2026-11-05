/**
 * Final audit — the fixes that show on a running server, end to end, on
 * the local production build (never production):
 *
 *   F-27  a revoked session reaches the sign-in form, no redirect loop
 *         (the web re-checks sessions every 5 minutes, so this waits 5½);
 *         a live session is still sent home from /login;
 *   F-02  the camera is allowed for the site's own pages;
 *   F-34  the help centre is linked from the public footer;
 *   F-39  the private consoles are disallowed in robots.txt;
 *   F-03  "sign out everywhere" removes the account's push registrations.
 *
 *   node scripts/qa-final-audit.mjs [http://localhost:3101]
 *
 * Local only; everything it creates is removed.
 */
import { B, account, call, check, login, part, pg, summary, teardown } from "./qa-phase24-lib.mjs";

const hops = async (jar, path, max = 12) => {
  const chain = [];
  let url = path;
  for (let i = 0; i < max; i++) {
    const r = await call(jar, url);
    chain.push(`${r.status} ${new URL(url, B).pathname}`);
    const to = r.headers.get("location");
    if (r.status < 300 || r.status >= 400 || !to) return { chain, final: r.status, at: new URL(url, B).pathname };
    url = new URL(to, B).pathname + new URL(to, B).search;
  }
  return { chain, final: "loop", at: url };
};


try {
  part("Public fixes");
  const home = await fetch(`${B}/`);
  const policy = home.headers.get("permissions-policy") ?? "";
  check("F-02: the camera is allowed for this site's pages", /(^|, )camera=\(self\)/.test(policy), policy);
  const html = await home.text();
  check("F-34: the footer links the help centre", /href="\/help"/.test(html));
  const robots = await (await fetch(`${B}/robots.txt`)).text();
  check("F-39: robots disallows the private consoles", /Disallow: \/org-admin\//.test(robots) && /Disallow: \/venue-admin\//.test(robots));

  part("Sessions");
  const a = await account("loop", "مالك الحلقة");
  const other = await account("loop2", "تاني");
  const live = await hops(other, "/login");
  check("a live session is still sent home from /login", live.final === 200 && live.at !== "/login", live.chain.join(" → "));

  await pg.query(`INSERT INTO "DeviceToken" (id, "userId", token, platform) VALUES ($1, $2, $3, 'android')`, [`qa-final-${Date.now()}`, a.userId, `ExponentPushToken[qa-final-${Date.now()}]`]);
  const revoke = await call(a, "/api/account/sessions", { method: "POST", body: JSON.stringify({ everywhere: true }) });
  check("sign out everywhere answers", revoke.status === 200, `status ${revoke.status}`);
  const tokens = Number((await pg.query(`SELECT count(*) FROM "DeviceToken" WHERE "userId" = $1`, [a.userId])).rows[0].count);
  check("F-03: sign out everywhere removes the account's push registrations", tokens === 0, `${tokens} left`);

  // The browser that revokes has its own cookie cleared; the one that
  // loops is a second browser still holding a cookie from before.
  const stale = await account("loop-stale", "قديم");
  const otherCopy = await login(stale.email);
  await call(otherCopy, "/api/account/sessions", { method: "POST", body: JSON.stringify({ everywhere: true }) });
  console.log("  waiting 5½ minutes for the session re-check…");
  await new Promise((r) => setTimeout(r, 330_000));
  const after = await hops(stale, "/dashboard");
  check("F-27: a revoked session ends on the sign-in form, without a redirect loop", after.final === 200 && /login/.test(after.at), after.chain.join(" → "));
  const form = await hops(stale, "/login");
  check("F-27: /login itself shows the form for a revoked session", form.final === 200 && /login/.test(form.at), form.chain.join(" → "));
} finally {
  await teardown();
  await pg.end();
}
process.exitCode = summary() ? 1 : 0;
