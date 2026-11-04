/**
 * Removes channel_binding — @neondatabase/serverless uses HTTP/WS
 * transport, which doesn't support SCRAM channel binding. Parsed rather
 * than cut out with a pattern: when it is the first parameter
 * (`…/neondb?channel_binding=require&sslmode=require`, as Neon now
 * issues them), cutting `?channel_binding=require` left
 * `…/neondb&sslmode=require`, a database that does not exist.
 */
export function withoutChannelBinding(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("channel_binding")) return url;
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return url;
  }
}
