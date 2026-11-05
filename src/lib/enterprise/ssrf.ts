import { lookup } from "dns/promises";
import { lookup as lookupCb, type LookupAddress } from "dns";
import { isIP, type LookupFunction } from "net";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";

/**
 * A webhook URL may only point at the public internet: https, no
 * credentials in it, the default port, and a host that resolves only to
 * public addresses. Checked when the endpoint is saved and again before
 * every send (an address can change). The send itself (postPinned) checks
 * the address it actually connects to, so a host that answers one address
 * for the check and another for the connection (DNS rebinding) is refused
 * (final audit F-23).
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
    // Translated or embedded IPv4 (NAT64 64:ff9b::/96, 6to4 2002::/16,
    // IPv4-compatible ::a.b.c.d / ::7f00:1) can reach an internal IPv4
    // address: refused outright (final audit F-23).
    if (s.startsWith("64:ff9b:") || s.startsWith("2002:")) return true;
    if (/^::[0-9a-f.:]+$/.test(s)) return true;
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

/**
 * A dns.lookup for http(s).request that refuses private answers. Used as the
 * socket's own lookup, the address checked is the address connected to.
 */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookupCb(hostname, { ...options, all: true, verbatim: true }, (e, addresses) => {
    if (e) return callback(e, "", 4);
    const list = addresses as unknown as LookupAddress[];
    if (!privateTargetsAllowed() && (list.length === 0 || list.some((a) => isPrivateAddress(a.address)))) {
      return callback(Object.assign(new Error("private-address"), { code: "EPRIVATE" }), "", 4);
    }
    if (options.all) return (callback as unknown as (err: null, a: LookupAddress[]) => void)(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

/**
 * POSTs `body` and returns the status code, connecting only to a public
 * address (checked at connect time), never following redirects, and giving
 * up after `timeoutMs`. The response body is drained and discarded.
 */
export function postPinned(url: URL, headers: Record<string, string>, body: string, timeoutMs: number): Promise<number> {
  const request = url.protocol === "http:" ? httpRequest : httpsRequest;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: "POST", headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) }, lookup: publicOnlyLookup, timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    req.on("error", reject);
    req.end(body);
  });
}
