// Stores one anonymous game event. The request's IP address is never saved.
const allowedOrigins = new Set([
  "https://2550563-jung.github.io",
  "http://127.0.0.1:8877",
  "http://localhost:8877"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["visit", "run_start", "run_end", "share", "feedback"]);
const DEVICES = new Set(["desktop", "mobile", "tablet", "windows_app", "unknown"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://2550563-jung.github.io",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function label(value: unknown, fallback: string) {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(text) ? text : fallback;
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false }, 405);
  if (!allowedOrigins.has(req.headers.get("origin") || "")) return reply({ ok: false }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false }, 400);
  }
  const visitorId = String(body.visitorId || "");
  const event = String(body.event || "");
  if (!UUID.test(visitorId) || !EVENTS.has(event)) return reply({ ok: false }, 400);

  const wave = Math.floor(Number(body.wave));
  const device = String(body.device || "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/last_wave_analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    body: JSON.stringify({
      visitor_id: visitorId,
      event,
      source: label(body.source, "direct"),
      device: DEVICES.has(device) ? device : "unknown",
      first_visit: body.firstVisit === true,
      version: label(body.version, ""),
      mode: label(body.mode, ""),
      wave: Number.isSafeInteger(wave) && wave >= 0 ? wave : null
    })
  });
  if (!response.ok) {
    console.error(`insert failed: ${response.status}`);
    return reply({ ok: false }, 500);
  }
  return reply({ ok: true });
});
