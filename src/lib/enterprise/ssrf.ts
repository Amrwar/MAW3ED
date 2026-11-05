import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * A webhook URL may only point at the public internet: https, no
 * credentials in it, the default port, and a host that resolves only to
 * public addresses. Checked when the endpoint is saved and again before
 * every send (an address can change). Residual risk — a host that changes
 * its answer between the check and the connection (DNS rebinding) — is
 * recorded in docs/enterprise/INTEGRATION_GUIDE.md.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; why: string };

/**
 * Local QA only: WEBHOOK_ALLOW_PRIVATE=1 lets an endpoint be a test
 * receiver on this machine (http://localhost). Never on Vercel, whatever
 * the variable says.
 */
export function privateTargetsAllowed(): boolean {
  return process.env.WEBHOOK_ALLOW_PRIVATE === "1" && !process.env.VERCEL;
}

/** Pure: is this IP literal one an integration must never reach? */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast, reserved, broadcast
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    if (s.startsWith("::ffff:")) return isPrivateAddress(s.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true; // not an address at all: refuse
}

/** Pure: the URL's shape, before any lookup. */
export function checkUrlShape(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, why: "not-a-url" };
  }
  if (privateTargetsAllowed() && (url.protocol === "http:" || url.protocol === "https:")) return { ok: true, url };
  if (url.protocol !== "https:") return { ok: false, why: "https-only" };
  if (url.username || url.password) return { ok: false, why: "no-credentials" };
  if (url.port && url.port !== "443") return { ok: false, why: "default-port-only" };
  if (raw.length > 500) return { ok: false, why: "too-long" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) return { ok: false, why: "private-address" };
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return { ok: false, why: "private-address" };
  return { ok: true, url };
}

export async function checkPublicUrl(raw: string): Promise<UrlCheck> {
  const shape = checkUrlShape(raw);
  if (!shape.ok) return shape;
  if (privateTargetsAllowed()) return shape;
  const host = shape.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return shape;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) return { ok: false, why: "private-address" };
  } catch {
    return { ok: false, why: "unresolvable" };
  }
  return shape;
}
