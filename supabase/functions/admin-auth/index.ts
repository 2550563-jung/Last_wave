// The salt and hash live in Supabase secrets, never in this public repository:
//   supabase secrets set ADMIN_SALT=<hex> ADMIN_HASH=<hex>
// Without them every login fails with 503.
const ADMIN_SALT = Deno.env.get("ADMIN_SALT") || "";
const ADMIN_HASH = Deno.env.get("ADMIN_HASH") || "";
const ITERATIONS = 210000;
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const allowedOrigins = new Set([
  "https://2550563-jung.github.io",
  "http://127.0.0.1:8877",
  "http://localhost:8877"
]);

function hexBytes(value: string) {
  return new Uint8Array(value.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
}
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
async function passwordHash(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexBytes(ADMIN_SALT), iterations: ITERATIONS },
    key,
    256
  );
  return new Uint8Array(bits);
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false }), { status: 405, headers });
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins.has(origin)) return new Response(JSON.stringify({ ok: false }), { status: 403, headers });
  if (!ADMIN_SALT || !ADMIN_HASH) return new Response(JSON.stringify({ ok: false }), { status: 503, headers });

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || req.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const saved = attempts.get(clientKey);
  const active = saved && saved.resetAt > now ? saved : { count: 0, resetAt: now + WINDOW_MS };
  if (active.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((active.resetAt - now) / 1000);
    return new Response(JSON.stringify({ ok: false, retryAfter }), { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers });
  }
  if (!/^\d{8}$/.test(password)) {
    active.count += 1; attempts.set(clientKey, active);
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers });
  }

  const valid = constantTimeEqual(await passwordHash(password), hexBytes(ADMIN_HASH));
  await new Promise((resolve) => setTimeout(resolve, valid ? 180 : 700));
  if (!valid) {
    active.count += 1; attempts.set(clientKey, active);
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers });
  }
  attempts.delete(clientKey);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
